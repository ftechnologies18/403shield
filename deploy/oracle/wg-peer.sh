#!/usr/bin/env bash
# wg-peer.sh — cycle de vie des peers WireGuard (N°284, v2 N°285, v3 N°312,
# v4 N°313) — ROOT only
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
#   wg-peer.sh add-router <nom> <pub> — peer ROUTEUR MikroTik (clé publique fournie par le
#                                       routeur, livret .router.txt pour la console MikCloud)
#   wg-peer.sh remove <nom>           — révocation (bloc + fichiers livrables supprimés)
#   wg-peer.sh qr <nom>               — QR de la conf client (les deux formes)
#   wg-peer.sh show-router <nom>      — ré-affiche le livret d'un routeur
#   wg-peer.sh reip <ip>              — changement d'endpoint (IP publique)
#   wg-peer.sh list                   — tableau des peers (handshake, transferts)
#
# SEGMENTS DU POOL TUNNEL (v4 — N°313, décision D-T5) : le /24 historique
# devient TROIS segments /24 sur le même wg0 :
#   - 10.8.0.0/24  : routeurs de GESTION (renfort N°285) + peers VPN
#                    HISTORIQUES (posés avant la v4 — jamais déplacés) ;
#   - 10.8.1.0/24  : peers VPN « fulltunnel » B2C (vitrine /vpn, ventes) ;
#   - 10.8.2.0/24  : peers « remote » (accès distant du gérant, N°312).
# Capacité du pool : 253 → 759 adresses tunnel ; familles de trafic isolées
# (un peer remote ne partage plus son /24 avec les clients B2C). Les adresses
# IPv6 suivent le même découpage : fd00:8::N (historique), fd00:8:1::N
# (fulltunnel B2C), fd00:8:2::N (remote).
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
usage(){ echo "usage: wg-peer.sh add <nom> [fulltunnel|remote] | add-router <nom> <pubkey> | remove <nom> | qr <nom> | show-router <nom> | reip <ip> | list"; exit 1; }
name2pub(){ awk -v n="$1" 'BEGIN{RS=""} index($0,"# peer: "n"\n")==1{c=split($0,L,"\n"); for(i=1;i<=c;i++) if(L[i]~/^PublicKey = /){sub("PublicKey = ","",L[i]);print L[i]}}' "$WG_CONF"; }
apply(){ wg syncconf wg0 <(wg-quick strip wg0); }
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
