#!/usr/bin/env bash
# wg-peer.sh — cycle de vie des peers WireGuard (N°284, v2 N°285, v3 N°312,
# v4 N°313, v5 N°315, v6 N°342) — ROOT only
#
# usage:
#   wg-peer.sh add <nom> [forme]     — peer client (clé générée ici, conf client .conf).
#                                      forme = fulltunnel (défaut : tout le trafic sort par
#                                      la VM, conf 0.0.0.0/0 + ::/0) | remote (N°312 :
#                                      accès distant du gérant — SUPERVISION de ses
#                                      routeurs via le tunnel, conf 10.8.0.0/24 +
#                                      10.8.2.0/24, pas de DNS tunnel — l'appel de forme
#                                      par un wg-peer.sh antérieur est simplement IGNORÉ,
#                                      dégradation propre)
#   wg-peer.sh add-guest <nom> <ip-hôte> <ports> — v6/N°342 (Accès Invité) : peer INVITÉ
#                                      expirable sur le segment 10.8.3.0/24, conf
#                                      AllowedIPs = <ip-hôte>/32 SEULEMENT (l'appareil Pro
#                                      de l'hôte, ex. 10.8.2.13) + pin-holes iptables
#                                      invité→hôte sur les ports déclarés (1-6, TCP+UDP).
#                                      Fail-closed par construction : chaîne dédiée
#                                      mikcloud-guests à DROP terminal, saut FORWARD AVANT
#                                      les ACCEPT génériques — un invité ne peut atteindre
#                                      QUE son hôte, sur les ports pin-holés (même avec
#                                      une conf trafiquée 0.0.0.0/0).
#   wg-peer.sh guest-restore          — v6/N°342 : reconstruit la chaîne mikcloud-guests
#                                      (jump + fermetures + pin-holes) depuis les sidecars
#                                      .guest — idempotent, appelé au boot (PostUp) et à
#                                      chaque add-guest/remove d'invité.
#   wg-peer.sh add-router <nom> <pub> — peer ROUTEUR MikroTik (clé publique fournie par le
#                                       routeur, livret .router.txt pour la console MikCloud)
#   wg-peer.sh set-lan <nom> <cidr>   — v5/N°315 (D-B1 brique 2) : étend l'AllowedIPs du PEER
#                                       ROUTEUR dans wg0.conf («10.8.0.N/32, <cidr>») — la VM
#                                       route le sous-réseau LAN vers ce routeur. Idempotent,
#                                       collision REFUSÉE (un préfixe = un routeur, cryptokey
#                                       routing), /24 privé RFC1918 hors 10.8.0.0/16 SEULEMENT.
#   wg-peer.sh lan-extend <nom> <cidr> — v5/N°315 : étend la CONF CLIENTE d'un peer remote
#                                       (AllowedIPs = 10.8.0.0/24, 10.8.2.0/24, <cidr> — les
#                                       autres LAN déjà étendus préservés) ; la conf relue par
#                                       wg-mini sert de preuve au cloud (mise à jour copie).
#   wg-peer.sh remove <nom>           — révocation (bloc + fichiers livrables supprimés)
#   wg-peer.sh qr <nom>               — QR de la conf client (les deux formes)
#   wg-peer.sh show-router <nom>      — ré-affiche le livret d'un routeur
#   wg-peer.sh reip <ip>              — changement d'endpoint (IP publique)
#   wg-peer.sh list                   — tableau des peers (handshake, transferts)
#
# SEGMENTS DU POOL TUNNEL (v4 — N°313, décision D-T5 ; v6 — N°342) : le /24
# historique devient QUATRE segments /24 sur le même wg0 :
#   - 10.8.0.0/24  : routeurs de GESTION (renfort N°285) + peers VPN
#                    HISTORIQUES (posés avant la v4 — jamais déplacés) ;
#   - 10.8.1.0/24  : peers VPN « fulltunnel » B2C (vitrine /vpn, ventes) ;
#   - 10.8.2.0/24  : peers « remote » (accès distant du gérant, N°312) ;
#   - 10.8.3.0/24  : peers « INVITÉS » (N°342) — fail-closed : chaîne dédiée
#                    mikcloud-guests (DROP terminal, pin-holes seuls), AUCUN
#                    MASQUERADE, fermeture B2C/routeurs vers ce segment.
# Capacité du pool : 253 → 1012 adresses tunnel ; familles de trafic isolées
# (un peer remote ne partage plus son /24 avec les clients B2C, un invité
# n'atteint QUE son hôte). Les adresses IPv6 suivent le même découpage :
# fd00:8::N (historique), fd00:8:1::N (fulltunnel B2C), fd00:8:2::N (remote),
# fd00:8:3::N (invités — allouée mais hors AllowedIPs de la conf : le
# cryptokey routing WireGuard lui-même bloque tout v6 invité, v4 seul en v1).
#
# POSE DES SEGMENTS SECONDAIRES (10.8.1/10.8.2) — ensure_segments, appelée à
# CHAQUE « add » client :
#   - RUNTIME : adresses secondaires posées sur wg0 + règles iptables
#     idempotentes (vérifiées par -C avant -A). Le segment remote reçoit les
#     seules règles FORWARD (hairpin wg0→wg0 vers les routeurs 10.8.0.x) —
#     AUCUN MASQUERADE : un peer remote ne peut JAMAIS utiliser la VM comme
#     sortie Internet (fail-closed, même avec une conf trafiquée). Le segment
#     B2C reçoit MASQUERADE v4+v6 (full-tunnel, c'est le produit).
#   - BOOT : les mêmes gestes sont insérés dans le bloc [Interface] de
#     wg0.conf sous forme de lignes PostUp marquées « # mikcloud-segments » —
#     wg-quick les rejoue à chaque montée de l'interface (donc à chaque
#     reboot). « wg syncconf » (apply) ne rejoue PAS PostUp : c'est le rôle
#     du volet runtime. wg-quick strip retire les PostUp avant syncconf —
#     aucun conflit.
#
# Discipline (runbook §9/§10) : les clés privées et les PSK ne sortent JAMAIS
# ici — les livrables sont des fichiers 600 root ; les logs ne portent que du
# non-secret (noms, adresses tunnel, fingerprints).
set -euo pipefail
WG_CONF=/etc/wireguard/wg0.conf
PEERS_DIR=/opt/wireguard/peers
EP_FILE=/opt/wireguard/endpoint
[ "$(id -u)" = "0" ] || { echo "root requis"; exit 1; }
[ -f "$WG_CONF" ] || { echo "wg0.conf absent — lancer mode=install d'abord"; exit 1; }
cmd="${1:-}"; name="${2:-}"
usage(){ echo "usage: wg-peer.sh add <nom> [fulltunnel|remote] | add-guest <nom> <ip-hôte> <ports> | guest-restore | add-router <nom> <pubkey> | set-lan <nom> <cidr> | lan-extend <nom> <cidr> | remove <nom> | qr <nom> | show-router <nom> | reip <ip> | list"; exit 1; }
name2pub(){ awk -v n="$1" 'BEGIN{RS=""} index($0,"# peer: "n"\n")==1{c=split($0,L,"\n"); for(i=1;i<=c;i++) if(L[i]~/^PublicKey = /){sub("PublicKey = ","",L[i]);print L[i]}}' "$WG_CONF"; }
apply(){ wg syncconf wg0 <(wg-quick strip wg0); }

# ── LAN étendu (v5 — N°315, D-B1) ─────────────────────────────────────────
# valid_lan — un CIDR LAN /24 PRIVÉ (RFC1918), hors de TOUT l'espace du pool
# tunnel : 10.8.0.0/16 ENTIÈRMENT refusé (segments 10.8.0/1/2 réservés au
# tunnel + marge future — un LAN qui s'y chevaucherait casserait le cryptokey
# routing de wg0 et volerait des adresses du pool). Même règle côté cloud
# (agent.ValidWgLanCIDR) et côté backend : défense aux trois frontières.
valid_lan(){
  local LAN="${1:-}"
  echo "$LAN" | grep -qE '^(10\.([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])|172\.(1[6-9]|2[0-9]|3[01])|192\.168)\.([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\.0/24$' || return 1
  case "$LAN" in 10.8.*) return 1 ;; esac
  return 0
}
# alloc <préfixe-segment> — prochaine adresse libre du segment (N ≥ 2 : le .1
# est la gateway du segment, posée par ensure_segments). v4 : le préfixe
# détermine le segment ; les peers des AUTRES segments ne comptent pas.
alloc(){
  local SEG="${1:-10.8.0}"
  local ESC="${SEG//./\\.}"
  USED=$(grep -oE "${ESC}\.[0-9]+" "$WG_CONF" | awk -F. '{print $4}' | sort -un)
  local N=2
  while echo "$USED" | grep -qx "$N"; do N=$((N+1)); done
  [ "$N" -le 254 ] || { echo "❌ pool ${SEG}.0/24 épuisé"; exit 1; }
  echo "$N"
}
server_pub(){ awk '/^PrivateKey/{print $3; exit}' "$WG_CONF" | wg pubkey; }

# ── Invités (v6 — N°342, Accès Invité) ────────────────────────────────────
# GUEST_POSTUP — bloc boot du segment invité : adresse secondaire + appel à
# guest-restore (chaîne + fermetures + pin-holes). Marqueur « # mikcloud-guests »
# indépendant de « # mikcloud-segments » : une VM en v5 reçoit le bloc au
# premier add-guest SANS toucher au bloc segments existant (upgrade in place).
# Le chemin du script est canonique (wg-mini tolère WG_PEER_SCRIPT pour ses
# propres appels ; le PostUp du wg0.conf DOIT être absolu).
GUEST_POSTUP='# mikcloud-guests (N°342) — segment INVITÉS 10.8.3.0/24, fail-closed
PostUp = ip -4 address add 10.8.3.1/24 dev %i 2>/dev/null || true
PostUp = ip -6 address add fd00:8:3::1/64 dev %i 2>/dev/null || true
PostUp = /opt/wireguard/wg-peer.sh guest-restore'

# ensure_boot_guests — insère le bloc GUEST_POSTUP sous [Interface] de wg0.conf
# (UNE fois, présence testée par le marqueur) : wg-quick le rejoue à chaque
# montée de wg0 — le segment et sa chaîne survivent au reboot.
ensure_boot_guests(){
  grep -q '^# mikcloud-guests' "$WG_CONF" && return 0
  local tmp; tmp=$(mktemp)
  awk -v block="$GUEST_POSTUP" '
    { print }
    /^\[Interface\]$/ && !ins { printf "%s\n", block; ins=1 }
  ' "$WG_CONF" > "$tmp" || { rm -f "$tmp"; echo "❌ insertion PostUp invités impossible"; exit 1; }
  install -m 600 "$tmp" "$WG_CONF"; rm -f "$tmp"
}

# guest_pin — UN pin-hole invité→hôte (TCP + UDP, multiport) : la règle est
# ciblée /32→/32 (l'invité N vers SON hôte, sur SES ports déclarés) et vit
# dans la chaîne dédiée, AVANT le DROP terminal.
guest_pin(){
  local GIP="$1" HIP="$2" PRT="$3"
  for PROTO in tcp udp; do
    iptables -C mikcloud-guests -s "${GIP}/32" -d "${HIP}/32" -p "$PROTO" -m multiport --dports "$PRT" -j ACCEPT 2>/dev/null || \
      iptables -I mikcloud-guests 1 -s "${GIP}/32" -d "${HIP}/32" -p "$PROTO" -m multiport --dports "$PRT" -j ACCEPT
  done
}

# guest_restore — reconstruit la chaîne mikcloud-guests de zéro (idempotent) :
#   1. chaîne dédiée + DROP terminal — un invité sans pin-hole ne passe RIEN ;
#   2. saut FORWARD en TÊTE de liste (-I 1) : le trafic -s 10.8.3.0/24 est
#      gouverné AVANT les ACCEPT génériques des segments v4 — même une conf
#      trafiquée (0.0.0.0/0, LAN d'un autre) se heurte au mur (fail-closed) ;
#   3. fermetures entrantes : B2C (10.8.1.0/24) et routeurs (10.8.0.0/24) ne
#      peuvent PAS initier vers les invités — l'hôte seul (10.8.2.x, ACCEPT
#      générique du hairpin) répond à son invité ;
#   4. pin-holes relus des sidecars $PEERS_DIR/*.guest (ip/host/ports) — la
#      mémoire des invités VIT dans ces fichiers, pas dans iptables.
# NB : le retour hôte→invité passe par l'ACCEPT générique -s 10.8.2.0/24 déjà
# posé par ensure_runtime_segments : aucun geste supplémentaire (le couple
# pin-hole aller / ACCEPT générique retour suffit, étatless des deux bords).
guest_restore(){
  iptables -N mikcloud-guests 2>/dev/null || true
  iptables -F mikcloud-guests
  iptables -A mikcloud-guests -j DROP
  iptables -C FORWARD -s 10.8.3.0/24 -j mikcloud-guests 2>/dev/null || \
    iptables -I FORWARD 1 -s 10.8.3.0/24 -j mikcloud-guests
  iptables -C FORWARD -s 10.8.1.0/24 -d 10.8.3.0/24 -j DROP 2>/dev/null || \
    iptables -I FORWARD 1 -s 10.8.1.0/24 -d 10.8.3.0/24 -j DROP
  iptables -C FORWARD -s 10.8.0.0/24 -d 10.8.3.0/24 -j DROP 2>/dev/null || \
    iptables -I FORWARD 1 -s 10.8.0.0/24 -d 10.8.3.0/24 -j DROP
  local GIP HIP PRT n=0
  for f in "$PEERS_DIR"/*.guest; do
    [ -f "$f" ] || continue
    GIP=$(sed -n 's/^ip=//p' "$f" | head -1)
    HIP=$(sed -n 's/^host=//p' "$f" | head -1)
    PRT=$(sed -n 's/^ports=//p' "$f" | head -1)
    [ -n "$GIP" ] && [ -n "$HIP" ] && [ -n "$PRT" ] || continue
    guest_pin "$GIP" "$HIP" "$PRT"
    n=$((n+1))
  done
  return 0
}

# ── Segments secondaires (N°313) — gestes idempotents boot + runtime ──────
SEG_POSTUP='# mikcloud-segments (N°313) — segments secondaires du pool tunnel (10.8.1 B2C / 10.8.2 remote)
PostUp = ip -4 address add 10.8.1.1/24 dev %i 2>/dev/null || true
PostUp = ip -4 address add 10.8.2.1/24 dev %i 2>/dev/null || true
PostUp = ip -6 address add fd00:8:1::1/64 dev %i 2>/dev/null || true
PostUp = ip -6 address add fd00:8:2::1/64 dev %i 2>/dev/null || true
PostUp = iptables -t nat -A POSTROUTING -s 10.8.1.0/24 -j MASQUERADE
PostUp = ip6tables -t nat -A POSTROUTING -s fd00:8:1::/64 -j MASQUERADE
PostUp = iptables -A FORWARD -s 10.8.1.0/24 -j ACCEPT
PostUp = iptables -A FORWARD -d 10.8.1.0/24 -j ACCEPT
PostUp = iptables -A FORWARD -s 10.8.2.0/24 -j ACCEPT
PostUp = iptables -A FORWARD -d 10.8.2.0/24 -j ACCEPT'

# ensure_boot_segments — insère le bloc PostUp marqué sous [Interface] de
# wg0.conf (UNE fois, présence testée par le marqueur) : wg-quick rejoue ces
# gestes à chaque montée de wg0 — les segments survivent au reboot.
ensure_boot_segments(){
  grep -q '^# mikcloud-segments' "$WG_CONF" && return 0
  local tmp; tmp=$(mktemp)
  awk -v block="$SEG_POSTUP" '
    { print }
    /^\[Interface\]$/ && !ins { printf "%s\n", block; ins=1 }
  ' "$WG_CONF" > "$tmp" || { rm -f "$tmp"; echo "❌ insertion PostUp segments impossible"; exit 1; }
  install -m 600 "$tmp" "$WG_CONF"; rm -f "$tmp"
}

# ensure_runtime_segments — pose les gestes AUSSI en direct (syncconf ne
# rejoue pas PostUp, et wg0 est déjà monté) : tout est idempotent (erreur si
# déjà présent → ignorée ; règles vérifiées par -C avant -A).
ensure_runtime_segments(){
  ip -4 address add 10.8.1.1/24 dev wg0 2>/dev/null || true
  ip -4 address add 10.8.2.1/24 dev wg0 2>/dev/null || true
  ip -6 address add fd00:8:1::1/64 dev wg0 2>/dev/null || true
  ip -6 address add fd00:8:2::1/64 dev wg0 2>/dev/null || true
  iptables -t nat -C POSTROUTING -s 10.8.1.0/24 -j MASQUERADE 2>/dev/null || iptables -t nat -A POSTROUTING -s 10.8.1.0/24 -j MASQUERADE
  ip6tables -t nat -C POSTROUTING -s fd00:8:1::/64 -j MASQUERADE 2>/dev/null || ip6tables -t nat -A POSTROUTING -s fd00:8:1::/64 -j MASQUERADE
  iptables -C FORWARD -s 10.8.1.0/24 -j ACCEPT 2>/dev/null || iptables -A FORWARD -s 10.8.1.0/24 -j ACCEPT
  iptables -C FORWARD -d 10.8.1.0/24 -j ACCEPT 2>/dev/null || iptables -A FORWARD -d 10.8.1.0/24 -j ACCEPT
  iptables -C FORWARD -s 10.8.2.0/24 -j ACCEPT 2>/dev/null || iptables -A FORWARD -s 10.8.2.0/24 -j ACCEPT
  iptables -C FORWARD -d 10.8.2.0/24 -j ACCEPT 2>/dev/null || iptables -A FORWARD -d 10.8.2.0/24 -j ACCEPT
  # NB : AUCUN MASQUERADE pour 10.8.2.0/24 (remote) — supervision seule,
  # fail-closed : le segment remote ne peut pas sortir sur Internet.
}

case "$cmd" in
  add)
    [ -n "$name" ] || usage
    # N°312 — forme de produit : fulltunnel (défaut, rétro-compatible) ou
    # remote (supervision B2B). N°313 — chaque forme a SON segment v4 :
    # fulltunnel → 10.8.1.0/24 (fd00:8:1::N), remote → 10.8.2.0/24
    # (fd00:8:2::N) ; les peers posés avant la v4 restent sur 10.8.0.x
    # (jamais déplacés — la conf d'un client actif n'est pas réécrite).
    # Le 3e argument est ignoré par un wg-peer.sh antérieur : le cloud
    # VÉRIFIE la conf renvoyée (AllowedIPs) avant de l'accepter.
    KIND="${3:-fulltunnel}"
    case "$KIND" in fulltunnel|remote) ;; *) echo "❌ forme inconnue : $KIND (fulltunnel|remote)"; exit 1;; esac
    echo "$name" | grep -qE '^[a-z0-9][a-z0-9-]{0,31}$' || { echo "❌ nom invalide"; exit 1; }
    [ -z "$(name2pub "$name")" ] || { echo "❌ peer '$name' existe déjà"; exit 1; }
    if [ "$KIND" = "remote" ]; then
      SEG="10.8.2"; V6P="fd00:8:2"
    else
      SEG="10.8.1"; V6P="fd00:8:1"
    fi
    ensure_boot_segments
    ensure_runtime_segments
    N=$(alloc "$SEG")
    EP=$(cat "$EP_FILE")
    SPUB=$(server_pub)
    PRIV=$(umask 077; wg genkey)
    PUB=$(printf '%s' "$PRIV" | wg pubkey)
    PSK=$(umask 077; wg genpsk)
    # Le bloc [Peer] côté VM est IDENTIQUE pour les deux formes (AllowedIPs
    # = l'adresse du peer, son segment v4 + son ULA v6 de segment) : seule la
    # CONF CLIENT diffère — c'est elle qui décide de ce qui entre dans le
    # tunnel côté gérant.
    printf '\n# peer: %s\n[Peer]\nPublicKey = %s\nPresharedKey = %s\nAllowedIPs = %s.%s/32, %s::%s/128\n' "$name" "$PUB" "$PSK" "$SEG" "$N" "$V6P" "$N" >> "$WG_CONF"
    apply
    mkdir -p "$PEERS_DIR"
    if [ "$KIND" = "remote" ]; then
      # N°312/v4 — remote : supervision du réseau tunnel UNIQUEMENT — ses
      # routeurs (10.8.0.0/24, segment gestion) + son propre segment
      # (10.8.2.0/24, gateway .1 comprise) ; pas de DNS via le tunnel
      # (supervision par IP), pas de 0.0.0.0/0. Keepalive 25 s : le gérant
      # est derrière CGNAT comme les routeurs.
      cat > "$PEERS_DIR/${name}.conf" <<CLIENTCONF
[Interface]
PrivateKey = ${PRIV}
Address = ${SEG}.${N}/32, ${V6P}::${N}/128
MTU = 1420

[Peer]
PublicKey = ${SPUB}
PresharedKey = ${PSK}
Endpoint = ${EP}:51820
AllowedIPs = 10.8.0.0/24, 10.8.2.0/24
PersistentKeepalive = 25
CLIENTCONF
    else
      cat > "$PEERS_DIR/${name}.conf" <<CLIENTCONF
[Interface]
PrivateKey = ${PRIV}
Address = ${SEG}.${N}/32, ${V6P}::${N}/128
DNS = 1.1.1.1, 8.8.8.8
MTU = 1420

[Peer]
PublicKey = ${SPUB}
PresharedKey = ${PSK}
Endpoint = ${EP}:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
CLIENTCONF
    fi
    chmod 600 "$PEERS_DIR/${name}.conf"
    if [ "$KIND" = "remote" ]; then
      echo "✅ peer '$name' ajouté (remote — supervision tunnel, segment ${SEG}) — IP ${SEG}.${N} — fingerprint $(printf '%s' "$PUB" | sha256sum | cut -c1-12)…"
    else
      echo "✅ peer '$name' ajouté (fulltunnel, segment ${SEG}) — IP ${SEG}.${N} — fingerprint $(printf '%s' "$PUB" | sha256sum | cut -c1-12)…"
    fi
    echo "   conf client : $PEERS_DIR/${name}.conf (600 root — SECRET, ne jamais coller dans un log)"
    echo "   QR (SSH interactif) : sudo qrencode -t ansiutf8 < $PEERS_DIR/${name}.conf"
    ;;
  add-guest)
    # N°342 (v6) — ACCÈS INVITÉ : peer expirable sur le segment 10.8.3.0/24.
    # L'HÔTE est un peer remote EXISTANT (10.8.2.x — un appareil Pro du compte
    # qui a commandé l'invité) : la conf cliente de l'invité ne route QUE
    # l'hôte (/32), et les pin-holes bornent les ports côté VM. Doctrine
    # 1 conf = 1 appareil inchangée ; l'expiration/révocation vit au CLOUD
    # (backend) qui appelle remove au terme — côté VM, remove = même geste.
    [ -n "$name" ] || usage
    HOSTIP="${3:-}"
    PORTS="${4:-}"
    echo "$name" | grep -qE '^[a-z0-9][a-z0-9-]{0,31}$' || { echo "❌ nom invalide"; exit 1; }
    [ -z "$(name2pub "$name")" ] || { echo "❌ peer '$name' existe déjà"; exit 1; }
    echo "$HOSTIP" | grep -qE '^10\.8\.2\.([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])$' || { echo "❌ IP hôte invalide : «${HOSTIP:-vide}» (attendu : l'adresse tunnel 10.8.2.x d'un appareil Pro)"; exit 1; }
    # L'hôte doit être un peer remote POSÉ sur wg0 (AllowedIPs = 10.8.2.H/32 en
    # premier item) — refus explicite plutôt qu'un invité vers une IP fantôme.
    HOSTFOUND=$(awk -v h="${HOSTIP}/32" 'BEGIN{RS=""} /^# peer: /{c=split($0,L,"\n"); for(i=1;i<=c;i++) if(L[i]~/^AllowedIPs = /){a=L[i]; sub("AllowedIPs = ","",a); split(a,B,","); gsub(/^[ \t]+|[ \t]+$/,"",B[1]); if(B[1]==h){print "1"; exit}}}' "$WG_CONF")
    [ -n "$HOSTFOUND" ] || { echo "❌ aucun peer remote à ${HOSTIP} sur wg0 — l'hôte d'un invité doit être un appareil Pro actif (10.8.2.x)"; exit 1; }
    echo "$PORTS" | grep -qE '^[0-9]{1,5}(,[0-9]{1,5}){0,5}$' || { echo "❌ ports invalides : «${PORTS:-vide}» (attendu : 1 à 6 ports, séparés par des virgules — ex. 25565 ou 3000,80,443)"; exit 1; }
    OKP=1
    OLDIFS="$IFS"; IFS=','
    for p in $PORTS; do
      [ "$p" -ge 1 ] 2>/dev/null && [ "$p" -le 65535 ] 2>/dev/null || OKP=0
    done
    IFS="$OLDIFS"
    [ "$OKP" = "1" ] || { echo "❌ port hors bornes (1-65535) dans «${PORTS}»"; exit 1; }
    SEG="10.8.3"; V6P="fd00:8:3"
    ensure_boot_segments
    ensure_runtime_segments
    ensure_boot_guests
    guest_restore
    N=$(alloc "$SEG")
    EP=$(cat "$EP_FILE")
    SPUB=$(server_pub)
    PRIV=$(umask 077; wg genkey)
    PUB=$(printf '%s' "$PRIV" | wg pubkey)
    PSK=$(umask 077; wg genpsk)
    # Bloc [Peer] identique aux autres formes (AllowedIPs = l'adresse de
    # l'invité, v4 + ULA v6) — le périmètre est porté par la CONF CLIENT
    # (AllowedIPs = hôte/32 SEUL) et par la chaîne mikcloud-guests (VM).
    printf '\n# peer: %s\n[Peer]\nPublicKey = %s\nPresharedKey = %s\nAllowedIPs = %s.%s/32, %s::%s/128\n' "$name" "$PUB" "$PSK" "$SEG" "$N" "$V6P" "$N" >> "$WG_CONF"
    apply
    mkdir -p "$PEERS_DIR"
    # Conf INVITÉ : AllowedIPs = l'hôte UNIQUEMENT — pas de 10.8.0.0/24 (les
    # routeurs ne regardent pas un invité), pas de 10.8.2.0/24 (les AUTRES
    # appareils Pro du compte non plus), pas de DNS, pas de 0.0.0.0/0. Le
    # keepalive 25 s traverse le CGNAT de l'invité comme celui du gérant.
    cat > "$PEERS_DIR/${name}.conf" <<CLIENTCONF
[Interface]
PrivateKey = ${PRIV}
Address = ${SEG}.${N}/32, ${V6P}::${N}/128
MTU = 1420

[Peer]
PublicKey = ${SPUB}
PresharedKey = ${PSK}
Endpoint = ${EP}:51820
AllowedIPs = ${HOSTIP}/32
PersistentKeepalive = 25
CLIENTCONF
    chmod 600 "$PEERS_DIR/${name}.conf"
    # Sidecar .guest — la mémoire du pin-hole (lue par guest_restore au boot
    # et à chaque geste invité) : ip de l'invité, hôte, ports déclarés.
    printf 'ip=%s.%s\nhost=%s\nports=%s\n' "$SEG" "$N" "$HOSTIP" "$PORTS" > "$PEERS_DIR/${name}.guest"
    chmod 600 "$PEERS_DIR/${name}.guest"
    guest_restore
    echo "✅ invité '$name' ajouté (segment ${SEG}) — IP ${SEG}.${N} → hôte ${HOSTIP} ports ${PORTS} — fingerprint $(printf '%s' "$PUB" | sha256sum | cut -c1-12)…"
    echo "   conf invité : $PEERS_DIR/${name}.conf (600 root — SECRET, à remettre à l'invité par le cloud)"
    echo "   QR (SSH interactif) : sudo qrencode -t ansiutf8 < $PEERS_DIR/${name}.conf"
    ;;
  guest-restore)
    guest_restore
    NPINS=$(( $(iptables -S mikcloud-guests 2>/dev/null | grep -c -- '-j ACCEPT') / 2 ))
    echo "✅ chaîne mikcloud-guests restaurée — ${NPINS} invité(s) pin-holé(s), DROP terminal en place (fail-closed)"
    ;;
  add-router)
    # N°285 — peer ROUTEUR : la clé publique est générée SUR le routeur
    # (commande wg_keygen, clé privée jamais transportée). Le livret
    # .router.txt porte les 4 valeurs à coller dans la console MikCloud
    # (PUT /api/routers/{id}/wg-params) : address / server_pub / psk / endpoint.
    # v4 : les routeurs RESTENT sur le segment gestion 10.8.0.0/24 (natif —
    # aucun geste de segment requis), v4 uniquement, comme depuis N°285.
    [ -n "$name" ] || usage
    RPUB="${3:-}"
    echo "$name" | grep -qE '^[a-z0-9][a-z0-9-]{0,31}$' || { echo "❌ nom invalide"; exit 1; }
    printf '%s' "$RPUB" | grep -qE '^[A-Za-z0-9+/]{43}=$' || { echo "❌ clé publique routeur invalide (44 caractères base64, « = » final)"; exit 1; }
    [ -z "$(name2pub "$name")" ] || { echo "❌ peer '$name' existe déjà (remove d'abord pour réémbarquer)"; exit 1; }
    N=$(alloc "10.8.0")
    EP=$(cat "$EP_FILE")
    SPUB=$(server_pub)
    PSK=$(umask 077; wg genpsk)
    # Pas d'IPv6 pour les routeurs (tunnel de gestion v4 uniquement —
    # l'ULA fd00:8::/64 reste réservée aux clients, N°284).
    printf '\n# peer: %s\n[Peer]\nPublicKey = %s\nPresharedKey = %s\nAllowedIPs = 10.8.0.%s/32\n' "$name" "$RPUB" "$PSK" "$N" >> "$WG_CONF"
    apply
    mkdir -p "$PEERS_DIR"
    cat > "$PEERS_DIR/${name}.router.txt" <<LIVRET
address=10.8.0.${N}
server_pub=${SPUB}
psk=${PSK}
endpoint=${EP}:51820
LIVRET
    chmod 600 "$PEERS_DIR/${name}.router.txt"
    echo "✅ peer routeur '$name' ajouté — IP tunnel 10.8.0.$N — fingerprint $(printf '%s' "$RPUB" | sha256sum | cut -c1-12)…"
    echo "   livret (600 root, SECRET) : $PEERS_DIR/${name}.router.txt"
    echo "   → coller les 4 valeurs dans la console MikCloud (Routeur → Tunnel WireGuard → Paramètres serveur)"
    echo "   ré-affichage : sudo /opt/wireguard/wg-peer.sh show-router $name"
    ;;
  set-lan)
    # N°315 (v5, D-B1 brique 2) — AllowedIPs du PEER ROUTEUR côté wg0.conf :
    # « 10.8.0.N/32, <lan> ». La VM route alors le sous-réseau LAN vers ce
    # routeur (cryptokey routing wg0). Idempotent : le <lan> du bloc est
    # REMPLACÉ (un routeur = UN LAN étendu v1), le /32 de gestion est
    # préservé (on ne retire JAMAIS la porte de gestion). Collision refusée :
    # un cidr déjà porté par le peer d'un AUTRE routeur ne peut pas être
    # routé deux fois (wg choisirait un seul gagnant — refus explicite plutôt
    # qu'un routage silencieux arbitraire, fail-closed).
    LAN="${3:-}"
    [ -n "$name" ] || usage
    valid_lan "$LAN" || { echo "❌ sous-réseau LAN invalide : «${LAN:-vide}» (attendu : /24 privé RFC1918, hors 10.8.0.0/16 — ex. 192.168.88.0/24)"; exit 1; }
    [ -n "$(name2pub "$name")" ] || { echo "❌ peer '$name' introuvable"; exit 1; }
    BASE=$(awk -v n="# peer: $name" 'BEGIN{RS=""} index($0,n"\n")==1{for(i=1;i<=split($0,L,"\n");i++) if(L[i]~/^AllowedIPs = /){a=L[i]; sub("AllowedIPs = ","",a); split(a,B,","); gsub(/^[ \t]+|[ \t]+$/,"",B[1]); print B[1]; exit}}' "$WG_CONF")
    echo "$BASE" | grep -qE '^10\.8\.0\.([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])/32$' || { echo "❌ '$name' n'est pas un peer routeur (AllowedIPs de gestion 10.8.0.N/32 introuvables)"; exit 1; }
    CLAIMER=$(awk -v lan="$LAN" 'BEGIN{RS=""} /^# peer: /{c=split($0,L,"\n"); n=L[1]; sub("# peer: ","",n); for(i=2;i<=c;i++) if(L[i]~/^AllowedIPs = /){a=L[i]; sub("AllowedIPs = ","",a); k=split(a,A,","); for(j=1;j<=k;j++){gsub(/^[ \t]+|[ \t]+$/,"",A[j]); if(A[j]==lan){print n; exit}}}}' "$WG_CONF")
    if [ -n "$CLAIMER" ] && [ "$CLAIMER" != "$name" ]; then
      echo "❌ $LAN déjà routé vers le routeur '$CLAIMER' — un sous-réseau ne peut être étendu qu'à UN routeur (renumérotez le LAN, ex. 10.10.x, ou retirez l'extension de l'autre routeur)"
      exit 1
    fi
    NEWLINE="AllowedIPs = ${BASE}, ${LAN}"
    if grep -qxF "$NEWLINE" "$WG_CONF"; then
      echo "✅ LAN $LAN déjà étendu sur le routeur '$name' — AllowedIPs = ${BASE}, ${LAN} (idempotent, rien à faire)"
      exit 0
    fi
    BEFORE=$(grep -c '^\[Peer\]' "$WG_CONF")
    awk -v m="# peer: ${name}" -v nl="$NEWLINE" 'BEGIN{RS="";ORS=""} { if(index($0,m"\n")==1){ c=split($0,L,"\n"); rebuilt=L[1]; for(i=2;i<=c;i++){ if(L[i]~/^AllowedIPs = /){rebuilt=rebuilt"\n"nl} else {rebuilt=rebuilt"\n"L[i]} }; $0=rebuilt } if(out!="")out=out"\n\n"; out=out $0 } END{print out"\n"}' "$WG_CONF" > /tmp/wg0.lan.$$
    AFTER=$(grep -c '^\[Peer\]' /tmp/wg0.lan.$$ || true)
    [ "$AFTER" = "$BEFORE" ] || { echo "❌ réécriture AllowedIPs ratée (peers $BEFORE→$AFTER)"; rm -f /tmp/wg0.lan.$$; exit 1; }
    install -m 600 /tmp/wg0.lan.$$ "$WG_CONF"; rm -f /tmp/wg0.lan.$$
    apply
    echo "✅ LAN étendu sur le routeur '$name' — AllowedIPs = ${BASE}, ${LAN} (syncconf à chaud, peers intacts)"
    ;;
  lan-extend)
    # N°315 (v5) — AllowedIPs de la CONF CLIENTE d'un peer remote : les deux
    # segments tunnel + le LAN demandé (les autres LAN déjà étendus — autres
    # routeurs du compte — sont PRÉSERVÉS). Un peer fulltunnel (0.0.0.0/0)
    # est REFUSÉ : le produit B2C ne touche jamais au LAN d'un routeur. La
    # conf relue par wg-mini sert de PREUVE au cloud (il remplace sa copie
    # chiffrée par cette vérité VM — jamais de confiance à un flag).
    LAN="${3:-}"
    [ -n "$name" ] || usage
    valid_lan "$LAN" || { echo "❌ sous-réseau LAN invalide : «${LAN:-vide}» (attendu : /24 privé RFC1918, hors 10.8.0.0/16 — ex. 192.168.88.0/24)"; exit 1; }
    CONF="$PEERS_DIR/${name}.conf"
    [ -f "$CONF" ] || { echo "❌ conf cliente inexistante pour '$name' (peer routeur ou inconnu)"; exit 1; }
    CUR=$(grep -m1 '^AllowedIPs = ' "$CONF" | sed 's/^AllowedIPs = //')
    echo "$CUR" | grep -q '^10\.8\.0\.0/24, 10\.8\.2\.0/24' || { echo "❌ '$name' n'est pas un peer remote (AllowedIPs inattendus : «$CUR»)"; exit 1; }
    NEW="10.8.0.0/24, 10.8.2.0/24"
    FOUND=0
    NLANS=0
    REST=$(printf '%s\n' "$CUR" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^10\.8\.[02]\.0/24$' || true)
    while IFS= read -r it; do
      [ -n "$it" ] || continue
      NLANS=$((NLANS+1))
      [ "$it" = "$LAN" ] && FOUND=1
      NEW="${NEW}, ${it}"
    done <<< "$REST"
    if [ "$FOUND" = "0" ]; then
      [ "$NLANS" -lt 6 ] || { echo "❌ trop de LAN étendus dans la conf de '$name' (borne v1 : 6)"; exit 1; }
      NEW="${NEW}, ${LAN}"
    fi
    sed -i "s#^AllowedIPs = .*#AllowedIPs = ${NEW}#" "$CONF"
    chmod 600 "$CONF"
    echo "✅ LAN $LAN étendu dans la conf de '$name' — AllowedIPs = ${NEW}"
    ;;
  remove)
    [ -n "$name" ] || usage
    [ -n "$(name2pub "$name")" ] || { echo "❌ peer '$name' introuvable"; exit 1; }
    BEFORE=$(grep -c '^\[Peer\]' "$WG_CONF")
    awk -v m="# peer: ${name}" 'BEGIN{RS="";ORS=""} index($0,m"\n")!=1{if(out!="")out=out"\n\n";out=out$0} END{print out"\n"}' "$WG_CONF" > /tmp/wg0.conf.new
    AFTER=$(grep -c '^\[Peer\]' /tmp/wg0.conf.new || true)
    [ "$AFTER" -lt "$BEFORE" ] || { echo "❌ retrait raté"; rm -f /tmp/wg0.conf.new; exit 1; }
    install -m 600 /tmp/wg0.conf.new "$WG_CONF"; rm -f /tmp/wg0.conf.new
    apply
    rm -f "$PEERS_DIR/${name}.conf" "$PEERS_DIR/${name}.router.txt"
    # N°342 — un INVITÉ emporte son pin-hole : sidecar supprimé + chaîne
    # reconstruite (les autres invités restent pin-holés, DROP terminal en
    # place). Les autres familles (routeurs, B2C, remote) ne passent pas ici.
    if [ -f "$PEERS_DIR/${name}.guest" ]; then
      rm -f "$PEERS_DIR/${name}.guest"
      guest_restore
      echo "   (invité : pin-hole retiré, chaîne mikcloud-guests reconstruite)"
    fi
    echo "✅ peer '$name' révoqué (bloc + livrables supprimés, tunnel des autres peers intact)"
    ;;
  qr)
    [ -n "$name" ] || usage
    [ -f "$PEERS_DIR/${name}.conf" ] || { echo "❌ conf inexistante"; exit 1; }
    qrencode -t ansiutf8 < "$PEERS_DIR/${name}.conf"
    ;;
  show-router)
    [ -n "$name" ] || usage
    [ -f "$PEERS_DIR/${name}.router.txt" ] || { echo "❌ livret inexistant (peer full-tunnel ou routeur jamais embarqué)"; exit 1; }
    cat "$PEERS_DIR/${name}.router.txt"
    ;;
  reip)
    NEWIP="${2:-}"
    echo "$NEWIP" | grep -qE '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' || { echo "❌ IP invalide"; exit 1; }
    echo "$NEWIP" > "$EP_FILE"
    for f in "$PEERS_DIR"/*.conf; do [ -f "$f" ] && sed -i "s/^Endpoint = .*/Endpoint = ${NEWIP}:51820/" "$f"; done
    for f in "$PEERS_DIR"/*.router.txt; do [ -f "$f" ] && sed -i "s/^endpoint=.*/endpoint=${NEWIP}:51820/" "$f"; done
    echo "✅ endpoint -> $NEWIP:51820 (confs clients + livrets routeurs mis à jour, clés conservées)"
    ;;
  list)
    echo "nom | IP tunnel | dernier handshake | reçu/envoyé"
    awk 'BEGIN{RS=""} /^# peer: /{c=split($0,L,"\n"); n=L[1]; sub("# peer: ","",n); ip=""; k=""; for(i=1;i<=c;i++){if(L[i]~/^AllowedIPs = /){ip=L[i];sub("AllowedIPs = ","",ip)}; if(L[i]~/^PublicKey = /){k=L[i];sub("PublicKey = ","",k)}} print k"|"n"|"ip}' "$WG_CONF" > /tmp/wgmap.$$
    while IFS='|' read -r KEY NM IP; do
      HS=$(wg show wg0 latest-handshakes | awk -v k="$KEY" '$1==k{print $2}')
      TR=$(wg show wg0 transfer | awk -v k="$KEY" '$1==k{print $2"/"$3}')
      [ -n "$TR" ] || TR="—"
      AGE="jamais"
      if [ -n "${HS:-}" ] && [ "$HS" != "0" ]; then AGE="$(( $(date +%s) - HS ))s"; fi
      echo "$NM | $IP | $AGE | $TR"
    done < /tmp/wgmap.$$
    rm -f /tmp/wgmap.$$
    ;;
  *) usage ;;
esac
