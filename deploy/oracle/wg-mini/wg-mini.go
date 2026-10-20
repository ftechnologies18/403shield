// wg-mini — N°291 (v2 : N°307, v3 : N°312, v4 : N°313, v5 : N°315, v6 : N°342) —
// passerelle locale WireGuard pour MikCloud (chantier ⑦, décision D3-a de
// N°289).
//
// RÔLE : le backend MikCloud tourne dans un conteneur distroless — il ne
// peut ni sudo ni toucher /etc/wireguard. wg-mini est une unité systemd
// ROOT (wg-peer.sh exige root) sur la MÊME VM qui expose les gestes de
// wg-peer.sh au backend, en boucle locale exclusivement :
//
//      POST /v1/add         {"name":"vpn-…","kind":"fulltunnel|remote"} → wg-peer.sh add <nom> [forme] → {"ok":true,"conf":"…","ip":"10.8.0.N"}
//      POST /v1/guest-add   {"name":"vpn-…","host":"10.8.2.N","ports":"25565"} → wg-peer.sh add-guest → {"ok":true,"conf":"…","ip":"10.8.3.N"}
//                            (N°342 Accès Invité : peer expirable du segment 10.8.3.0/24,
//                            conf AllowedIPs = host/32 SEUL + pin-holes invité→hôte sur les
//                            ports déclarés — 1 à 6, TCP+UDP, validés aux DEUX frontières)
//      POST /v1/add-router  {"name":"r-…","pub":"44car="} → wg-peer.sh add-router  → {"ok":true,"address":"…","serverPub":"…","psk":"…","endpoint":"…"}
//      POST /v1/remove      {"name":"vpn-…|r-…"}          → wg-peer.sh remove      → {"ok":true}
//      POST /v1/set-lan     {"name":"r-…","lan":"192.168.88.0/24"} → wg-peer.sh set-lan → {"ok":true,"allowed":"10.8.0.N/32, 192.168.88.0/24"}
//      POST /v1/lan-extend  {"name":"vpn-…","lan":"192.168.88.0/24"} → wg-peer.sh lan-extend → {"ok":true,"conf":"…","ip":"10.8.2.N"}
//      GET  /v1/conf?name=vpn-…                             → lecture conf           → {"ok":true,"conf":"…"}
//      GET  /v1/list                                          → wg-peer.sh list        → {"ok":true,"peers":[…]}
//      GET  /v1/ping                                          → {"ok":true,"service":"wg-mini","version":"v6"}
//
// v2 (N°307) : /v1/add-router ouvre le provisionnement AUTOMATIQUE du
// renfort WireGuard des routeurs (la clé publique vient du routeur — générée
// sur l'appareil par wg_keygen, la clé privée ne quitte jamais le routeur) ;
// /v1/remove accepte désormais AUSSI les peers routeurs (révocation
// automatique au démontage). Le backend dégrade proprement face à un v1
// (404 → message de mise à jour côté cloud).
//
// v3 (N°312) : /v1/add porte un champ « kind » OPTIONNEL (absent/vide =
// fulltunnel, rétro-compatible) transmis comme 3e argument de wg-peer.sh
// add — la forme « remote » (accès distant du gérant, supervision B2B de ses
// routeurs via le tunnel). Défense en profondeur : un wg-peer.sh ANTÉRIEUR
// ignore l'argument et rend une conf full-tunnel — le backend VÉRIFIE la
// conf renvoyée (AllowedIPs) avant de l'accepter, jamais de confiance
// aveugle à la version.
//
// v4 (N°313) : aucune NOUVELLE route ni champ — le bump porte la version du
// BINAIRE à celle de wg-peer.sh v4 (multi-segments du pool tunnel : B2C
// 10.8.1.0/24, remote 10.8.2.0/24 — la segmentation vit DANS wg-peer.sh,
// appelé tel quel). Le backend attend d'une VM v4 une conf remote
// « AllowedIPs = 10.8.0.0/24, 10.8.2.0/24 » (preuve par la conf) : une VM
// v3 rend « 10.8.0.0/24 » seul → refus explicite + consigne exploitant
// (ops-wg-mini-install) — dégradation honnête, identique au passage v2→v3.
//
// v5 (N°315 — Accès Pro / LAN étendu, D-B1) : DEUX routes nouvelles pour
// les briques 2 et 3 du design — /v1/set-lan (AllowedIPs du PEER ROUTEUR
// côté wg0.conf : la VM route le sous-réseau LAN vers ce routeur) et
// /v1/lan-extend (AllowedIPs de la CONF CLIENTE d'un peer remote : le LAN
// entre dans le tunnel côté gérant). PREUVE PAR LA CONF, discipline v3/v4 :
// set-lan RELIT l'AllowedIPs du peer dans wg0.conf et le renvoie (« allowed »)
// ; lan-extend RELIT la conf et la renvoie INTEGRALEMENT — le backend
// vérifie (cidr présent, forme remote intacte, jamais 0.0.0.0/0) avant de
// croire le geste. Un wg-mini v4 répond 404 sur ces routes : le backend
// traduit en consigne exploitant (ops-wg-mini-install, hot upgrade ~1 s).
//
// SÉCURITÉ (conventions §8 de docs/RUNBOOK-HEBERGEMENT.md) :
//   - bind 127.0.0.1:4020 UNIQUEMENT (port à réserver au registre) — aucune
//     traversée réseau publique ;
//   - TOUTE requête signée HMAC-SHA256("<ts>.<body>", WG_MINI_SECRET) — le
//     MÊME schéma que les webhooks GeniusPay du backend, inversé ;
//     fenêtre d'horloge ±120 s, comparaison à temps constant ;
//   - nom de peer validé par regex stricte côté mini ET côté cloud (aucun
//     caractère d'échappement ne peut atteindre exec — pas de shell) ; la clé
//     publique routeur est validée par la même regex que wg-peer.sh ;
//   - le secret et les confs ne sont JAMAIS logués (clés hors logs) ;
//   - timeouts partout (script 20 s, client 10 s), corps limité à 8 Ko.
//
// INSTALLATION : cf. README.md du répertoire (recette §8 complète, hot
// upgrade ~1 s : recompiler → install → systemctl restart).
package main

import (
        "context"
        "crypto/hmac"
        "crypto/sha256"
        "encoding/hex"
        "encoding/json"
        "errors"
        "fmt"
        "io"
        "log"
        "net"
        "net/http"
        "os"
        "os/exec"
        "path/filepath"
        "regexp"
        "strconv"
        "strings"
        "time"
)

const version = "v6"

var (
        addr       = envOr("WG_MINI_ADDR", "127.0.0.1:4020")
        scriptPath = envOr("WG_PEER_SCRIPT", "/opt/wireguard/wg-peer.sh")
        peersDir   = envOr("WG_PEERS_DIR", "/opt/wireguard/peers")
        wgConfPath = envOr("WG_CONF", "/etc/wireguard/wg0.conf")
        secret     = strings.TrimSpace(os.Getenv("WG_MINI_SECRET"))
)

// nameRe — peers CLIENTS B2C : mêmes règles que le cloud (model.vpnpeer.go) :
// préfixe « vpn- » obligatoire, minuscules/chiffres/tirets, aucun
// métacaractère.
var nameRe = regexp.MustCompile(`^vpn-[a-z0-9][a-z0-9-]{2,26}$`)

// routerNameRe — peers ROUTEURS de gestion (renfort N°285, automatisation
// N°307) : PAS de préfixe vpn- (réservé B2C — le retrait d'un add-router
// mal orienté est impossible), même charset que la suggestion cloud
// (WgPeerNameSuggestion : [a-z0-9][a-z0-9-]{0,31}).
var routerNameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)

// pubKeyRe — clé publique WireGuard (44 caractères base64 std, « = » final) :
// la même validation que wg-peer.sh add-router côté cloud (agent.ValidWgKey).
var pubKeyRe = regexp.MustCompile(`^[A-Za-z0-9+/]{43}=$`)

// peerAnyRe — /v1/remove accepte les DEUX espaces de noms (B2C vpn-* et
// routeurs de gestion) : la révocation automatique N°307 en dépend. Un
// remove sur un nom inexistant échoue proprement côté wg-peer.sh.
var peerAnyRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)

// lanRe — N°315 — un sous-réseau LAN étendu : /24 STRICT, dernier octet 0,
// espace privé RFC1918 (10.x | 172.16-31.x | 192.168.x). L'exclusion de
// TOUT l'espace du pool tunnel (10.8.0.0/16 — segments wg0 + marge future)
// est portée par validLanCIDR : même règle que agent.ValidWgLanCIDR côté
// cloud et valid_lan dans wg-peer.sh — défense aux TROIS frontières.
var lanRe = regexp.MustCompile(`^(10\.(\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])|172\.(1[6-9]|2\d|3[01])|192\.168)\.(\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])\.0/24$`)

// guestHostRe — N°342 — l'IP TUNNEL de l'hôte d'un invité : un appareil Pro
// du segment remote (10.8.2.N, N ≥ 2 — le .1 est la gateway). Même borne que
// wg-peer.sh add-guest côté VM et model.ValidGuestHostIP côté cloud — défense
// aux TROIS frontières. Un hôte B2C (10.8.1.x) ou routeur (10.8.0.x) est
// REFUSÉ : un invité ne partage JAMAIS autre chose qu'un appareil Pro.
var guestHostRe = regexp.MustCompile(`^10\.8\.2\.([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])$`)

// guestPortsRe — N°342 — 1 à 6 ports, csv sans espace (ex. « 25565 » ou
// « 3000,80,443 »). La borne 1-65535 par port et le décompte ≤ 6 sont
// revérifiés champ par champ (validGuestPorts) : même règle que
// model.ValidGuestPorts côté cloud et wg-peer.sh côté VM.
var guestPortsRe = regexp.MustCompile(`^[0-9]{1,5}(,[0-9]{1,5}){0,5}$`)

// validGuestPorts — chaque port dans [1, 65535] (le format csv est déjà
// garanti par guestPortsRe ; ici la BORNE numérique, car « 99999 » matche
// la regex mais n'est pas un port).
func validGuestPorts(s string) bool {
        for _, p := range strings.Split(s, ",") {
                n, err := strconv.Atoi(p)
                if err != nil || n < 1 || n > 65535 {
                        return false
                }
        }
        return true
}

// validLanCIDR — la règle complète (RFC1918 /24 ET hors 10.8.0.0/16).
func validLanCIDR(s string) bool {
        s = strings.TrimSpace(s)
        return s != "" && lanRe.MatchString(s) && !strings.HasPrefix(s, "10.8.")
}

// scriptTimeout — wg-peer.sh add génère des clés + syncconf : quelques ms
// sur la VM ; 20 s couvre une VM fatiguée sans laisser pendre une requête.
const scriptTimeout = 20 * time.Second

func envOr(key, def string) string {
        if v := strings.TrimSpace(os.Getenv(key)); v != "" {
                return v
        }
        return def
}

// ---------------------------------------------------------------------------
// Authentification HMAC (miroir exact du client backend wgmini.go)
// ---------------------------------------------------------------------------

func authorized(r *http.Request, body []byte) bool {
        tsRaw := r.Header.Get("X-WGMini-Timestamp")
        sig := r.Header.Get("X-WGMini-Signature")
        if tsRaw == "" || sig == "" {
                return false
        }
        ts, err := strconv.ParseInt(tsRaw, 10, 64)
        if err != nil {
                return false
        }
        if d := time.Since(time.Unix(ts, 0)); d > 120*time.Second || d < -120*time.Second {
                return false
        }
        mac := hmac.New(sha256.New, []byte(secret))
        fmt.Fprintf(mac, "%d.", ts)
        mac.Write(body)
        given, err := hex.DecodeString(strings.ToLower(sig))
        if err != nil {
                return false
        }
        return hmac.Equal(given, mac.Sum(nil))
}

// ---------------------------------------------------------------------------
// Helpers réponse + exécution script
// ---------------------------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, v any) {
        w.Header().Set("Content-Type", "application/json; charset=utf-8")
        w.WriteHeader(status)
        _ = json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, status int, msg string) {
        log.Printf("[refus] %s", msg) // messages techniques SEULEMENT — jamais de corps/conf
        writeJSON(w, status, map[string]any{"ok": false, "error": msg})
}

// runScript — exécute wg-peer.sh SANS shell (exec direct, arguments
// positionnels : l'injection est structurellement impossible).
func runScript(ctx context.Context, args ...string) (string, error) {
        c, cancel := context.WithTimeout(ctx, scriptTimeout)
        defer cancel()
        cmd := exec.CommandContext(c, scriptPath, args...)
        out, err := cmd.CombinedOutput()
        if err != nil {
                if c.Err() == context.DeadlineExceeded {
                        return "", errors.New("wg-peer.sh a dépassé 20 s — vérifiez wg0 sur la VM")
                }
                // dernier message utile du script (« ❌ … ») pour la console cloud
                msg := lastLine(string(out))
                if msg == "" {
                        msg = err.Error()
                }
                return "", errors.New(msg)
        }
        return string(out), nil
}

func lastLine(s string) string {
        s = strings.TrimSpace(s)
        if s == "" {
                return ""
        }
        lines := strings.Split(s, "\n")
        line := strings.TrimSpace(lines[len(lines)-1])
        if len(line) > 200 {
                line = line[:200]
        }
        return line
}

// confPath — chemin de la conf d'un peer (le nom est déjà validé par la
// regex : aucune traversée de chemin possible).
func confPath(name string) string {
        return filepath.Join(peersDir, name+".conf")
}

// parseIPFromConf — la ligne Address de la conf client (informationnel).
func parseIPFromConf(conf string) string {
        for _, line := range strings.Split(conf, "\n") {
                line = strings.TrimSpace(line)
                if strings.HasPrefix(line, "Address") {
                        parts := strings.SplitN(line, "=", 2)
                        if len(parts) == 2 {
                                ip := strings.TrimSpace(parts[1])
                                if i := strings.Index(ip, ","); i > 0 {
                                        ip = strings.TrimSpace(ip[:i]) // v4 d'abord, l'ULA v6 suit
                                }
                                return ip
                        }
                }
        }
        return ""
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// kindRe — formes de produit VPN (miroir de model.VpnKind* côté cloud) :
// absent/vide = fulltunnel (rétro-compatible avec tout backend v1/v2).
var kindRe = regexp.MustCompile(`^(fulltunnel|remote)$`)

func handleAdd(w http.ResponseWriter, r *http.Request) {
        var req struct {
                Name string `json:"name"`
                Kind string `json:"kind"`
        }
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                fail(w, http.StatusBadRequest, "corps invalide")
                return
        }
        name := strings.TrimSpace(req.Name)
        if !nameRe.MatchString(name) {
                fail(w, http.StatusBadRequest, "nom de peer invalide (attendu vpn-… minuscules/tirets)")
                return
        }
        kind := strings.TrimSpace(req.Kind)
        if kind == "" {
                kind = "fulltunnel"
        }
        if !kindRe.MatchString(kind) {
                fail(w, http.StatusBadRequest, "forme de peer inconnue (fulltunnel|remote)")
                return
        }
        start := time.Now()
        out, err := runScript(r.Context(), "add", name, kind)
        if err != nil {
                log.Printf("[add] %s échec (%s) : %v", name, time.Since(start).Round(time.Millisecond), err)
                fail(w, http.StatusBadGateway, err.Error())
                return
        }
        raw, err := os.ReadFile(confPath(name))
        if err != nil {
                log.Printf("[add] %s créé mais conf illisible : %v", name, err)
                fail(w, http.StatusInternalServerError, "peer créé sur wg0 mais conf illisible — vérifiez "+peersDir)
                return
        }
        conf := string(raw)
        log.Printf("[add] %s ok (%s, %s)", name, kind, time.Since(start).Round(time.Millisecond))
        writeJSON(w, http.StatusOK, map[string]any{
                "ok":   true,
                "name": name,
                "kind": kind,
                "ip":   parseIPFromConf(conf),
                "conf": conf,
                "_":    strings.TrimSpace(out), // trace wg-peer.sh (sans la conf)
        })
}

// handleGuestAdd — N°342 (v6) — POST /v1/guest-add
// {"name":"vpn-…","host":"10.8.2.N","ports":"25565"} : wg-peer.sh add-guest
// pose le peer INVITÉ sur le segment 10.8.3.0/24 (clés générées côté VM,
// conf AllowedIPs = host/32 SEUL, pin-holes invité→hôte sur les ports
// déclarés dans la chaîne dédiée mikcloud-guests — fail-closed). PREUVE PAR
// LA CONF (défense en profondeur, jamais de confiance aveugle à l'exit code
// du script) : la conf relue doit porter AllowedIPs = <host>/32 EXACTEMENT —
// ni 0.0.0.0/0, ni un segment entier (10.8.0.0/24, 10.8.2.0/24), ni un autre
// hôte : un wg-peer.sh avarié qui rendrait une conf élargie est REFUSÉ ici
// (et revérifié ENCORE côté backend — trois frontières).
func handleGuestAdd(w http.ResponseWriter, r *http.Request) {
        var req struct {
                Name  string `json:"name"`
                Host  string `json:"host"`
                Ports string `json:"ports"`
        }
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                fail(w, http.StatusBadRequest, "corps invalide")
                return
        }
        name := strings.TrimSpace(req.Name)
        host := strings.TrimSpace(req.Host)
        ports := strings.TrimSpace(req.Ports)
        if !nameRe.MatchString(name) {
                fail(w, http.StatusBadRequest, "nom de peer invalide (attendu vpn-… minuscules/tirets)")
                return
        }
        if !guestHostRe.MatchString(host) {
                fail(w, http.StatusBadRequest, "IP hôte invalide (attendu : l'adresse tunnel 10.8.2.x d'un appareil Pro)")
                return
        }
        if !guestPortsRe.MatchString(ports) || !validGuestPorts(ports) {
                fail(w, http.StatusBadRequest, "ports invalides (attendu : 1 à 6 ports en csv, ex. 25565 ou 3000,80,443)")
                return
        }
        start := time.Now()
        out, err := runScript(r.Context(), "add-guest", name, host, ports)
        if err != nil {
                log.Printf("[guest-add] %s échec (%s) : %v", name, time.Since(start).Round(time.Millisecond), err)
                fail(w, http.StatusBadGateway, err.Error())
                return
        }
        raw, err := os.ReadFile(confPath(name))
        if err != nil {
                log.Printf("[guest-add] %s créé mais conf illisible : %v", name, err)
                fail(w, http.StatusInternalServerError, "invité créé sur wg0 mais conf illisible — vérifiez "+peersDir)
                return
        }
        conf := string(raw)
        // Preuve par la conf : la ligne AllowedIPs doit être EXACTEMENT host/32.
        allowed := ""
        for _, line := range strings.Split(conf, "\n") {
                if strings.HasPrefix(strings.TrimSpace(line), "AllowedIPs = ") {
                        allowed = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "AllowedIPs = "))
                        break
                }
        }
        want := host + "/32"
        if allowed != want {
                log.Printf("[guest-add] %s conf relue non conforme (AllowedIPs = %q, attendu %q) — wg-peer.sh avarié ?", name, allowed, want)
                fail(w, http.StatusInternalServerError, "conf invité sans le périmètre attendu (AllowedIPs = "+want+") — vérifiez wg-peer.sh sur la VM")
                return
        }
        log.Printf("[guest-add] %s ok (hôte %s, ports %s, %s)", name, host, ports, time.Since(start).Round(time.Millisecond))
        writeJSON(w, http.StatusOK, map[string]any{
                "ok":    true,
                "name":  name,
                "host":  host,
                "ports": ports,
                "ip":    parseIPFromConf(conf),
                "conf":  conf,
                "_":     lastLine(string(out)), // trace wg-peer.sh (sans la conf)
        })
}

func handleRemove(w http.ResponseWriter, r *http.Request) {
        var req struct {
                Name string `json:"name"`
        }
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                fail(w, http.StatusBadRequest, "corps invalide")
                return
        }
        name := strings.TrimSpace(req.Name)
        // N°307 — B2C (vpn-*) ET routeurs de gestion : révocation automatique.
        if !peerAnyRe.MatchString(name) {
                fail(w, http.StatusBadRequest, "nom de peer invalide")
                return
        }
        start := time.Now()
        if _, err := runScript(r.Context(), "remove", name); err != nil {
                log.Printf("[remove] %s échec : %v", name, err)
                fail(w, http.StatusBadGateway, err.Error())
                return
        }
        log.Printf("[remove] %s ok (%s)", name, time.Since(start).Round(time.Millisecond))
        writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// handleAddRouter — N°307 — POST /v1/add-router {"name":"r-…","pub":"…="} :
// wg-peer.sh add-router <name> <pub> embarque le peer ROUTEUR (clé publique
// fournie par le routeur, PSK + adresse allouées sur la VM) puis le LIVRET
// .router.txt est relu et ses 4 valeurs retournées au backend (address,
// server_pub, psk, endpoint) — elles repartent aussitôt vers le routeur via
// le canal agent TLS strict du cloud. La PSK/clé serveur ne transitent que
// sur cette boucle locale signée (même frontière de confiance que le cat SSH
// du livret par l'exploitant en N°285 — sans l'exploitant).
func handleAddRouter(w http.ResponseWriter, r *http.Request) {
        var req struct {
                Name string `json:"name"`
                Pub  string `json:"pub"`
        }
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                fail(w, http.StatusBadRequest, "corps invalide")
                return
        }
        name := strings.TrimSpace(req.Name)
        pub := strings.TrimSpace(req.Pub)
        if !routerNameRe.MatchString(name) || strings.HasPrefix(name, "vpn-") {
                fail(w, http.StatusBadRequest, "nom de peer routeur invalide (minuscules/chiffres/tirets, sans préfixe vpn-)")
                return
        }
        if !pubKeyRe.MatchString(pub) {
                fail(w, http.StatusBadRequest, "clé publique routeur invalide (44 caractères base64, « = » final)")
                return
        }
        start := time.Now()
        out, err := runScript(r.Context(), "add-router", name, pub)
        if err != nil {
                log.Printf("[add-router] %s échec (%s) : %v", name, time.Since(start).Round(time.Millisecond), err)
                fail(w, http.StatusBadGateway, err.Error())
                return
        }
        raw, err := os.ReadFile(filepath.Join(peersDir, name+".router.txt"))
        if err != nil {
                log.Printf("[add-router] %s posé mais livret illisible : %v", name, err)
                fail(w, http.StatusInternalServerError, "peer routeur posé sur wg0 mais livret illisible — vérifiez "+peersDir)
                return
        }
        livret := parseLivret(string(raw))
        if livret["address"] == "" || livret["server_pub"] == "" || livret["psk"] == "" || livret["endpoint"] == "" {
                log.Printf("[add-router] %s livret incomplet", name)
                fail(w, http.StatusInternalServerError, "livret routeur incomplet — vérifiez wg-peer.sh sur la VM")
                return
        }
        log.Printf("[add-router] %s ok (%s)", name, time.Since(start).Round(time.Millisecond))
        // Le livret contient la PSK et la clé serveur : réponse signée HMAC,
        // boucle locale uniquement — jamais loguée.
        writeJSON(w, http.StatusOK, map[string]any{
                "ok":        true,
                "name":      name,
                "address":   livret["address"],
                "serverPub": livret["server_pub"],
                "psk":       livret["psk"],
                "endpoint":  livret["endpoint"],
                "_":         lastLine(string(out)), // trace wg-peer.sh (sans le livret)
        })
}

// parseLivret — découpe les lignes « clé=valeur » du .router.txt (fichier
// local 600 root déjà validé par regex de nom — aucune traversée possible).
func parseLivret(raw string) map[string]string {
        out := map[string]string{}
        for _, line := range strings.Split(raw, "\n") {
                line = strings.TrimSpace(line)
                if line == "" {
                        continue
                }
                if i := strings.IndexByte(line, '='); i > 0 {
                        out[line[:i]] = strings.TrimSpace(line[i+1:])
                }
        }
        return out
}

func handleConf(w http.ResponseWriter, r *http.Request) {
        name := strings.TrimSpace(r.URL.Query().Get("name"))
        if !nameRe.MatchString(name) {
                fail(w, http.StatusBadRequest, "nom de peer invalide")
                return
        }
        raw, err := os.ReadFile(confPath(name))
        if err != nil {
                fail(w, http.StatusNotFound, "conf introuvable pour "+name)
                return
        }
        writeJSON(w, http.StatusOK, map[string]any{"ok": true, "name": name, "conf": string(raw)})
}

// handleList — parse la sortie de wg-peer.sh list :
//
//      nom | IP tunnel | dernier handshake | reçu/envoyé
//      vpn-xxxx | 10.8.0.N/32[, fd00:8::N/128] | 12s|jamais | 1.2 MiB/3.4 MiB
func handleList(w http.ResponseWriter, r *http.Request) {
        out, err := runScript(r.Context(), "list")
        if err != nil {
                log.Printf("[list] échec : %v", err)
                fail(w, http.StatusBadGateway, err.Error())
                return
        }
        peers := []map[string]string{}
        for _, line := range strings.Split(out, "\n") {
                line = strings.TrimSpace(line)
                if line == "" || strings.HasPrefix(line, "nom |") || strings.Contains(line, "─") {
                        continue // en-tête / séparateur
                }
                parts := strings.Split(line, "|")
                if len(parts) < 4 {
                        continue
                }
                ip := strings.TrimSpace(parts[1])
                if i := strings.Index(ip, ","); i > 0 {
                        ip = strings.TrimSpace(ip[:i])
                }
                peers = append(peers, map[string]string{
                        "name":      strings.TrimSpace(parts[0]),
                        "ip":        ip,
                        "handshake": strings.TrimSpace(parts[2]),
                        "transfer":  strings.TrimSpace(parts[3]),
                })
        }
        writeJSON(w, http.StatusOK, map[string]any{"ok": true, "peers": peers})
}

func handlePing(w http.ResponseWriter, r *http.Request) {
        writeJSON(w, http.StatusOK, map[string]any{"ok": true, "service": "wg-mini", "version": version})
}

// peerAllowedIPs — N°315 — relit la ligne AllowedIPs du bloc [Peer] d'un
// peer de wg0.conf (même parcours par marqueur « # peer: » que name2pub côté
// script). Information NON secrète (aucune clé touchée) : c'est la matière
// de la PREUVE PAR LA CONF de /v1/set-lan.
func peerAllowedIPs(name string) string {
        raw, err := os.ReadFile(wgConfPath)
        if err != nil {
                return ""
        }
        want := "# peer: " + name
        inBlock := false
        for _, line := range strings.Split(string(raw), "\n") {
                line = strings.TrimSpace(line)
                if strings.HasPrefix(line, "# peer: ") {
                        inBlock = line == want
                        continue
                }
                if inBlock && strings.HasPrefix(line, "AllowedIPs = ") {
                        return strings.TrimSpace(strings.TrimPrefix(line, "AllowedIPs = "))
                }
        }
        return ""
}

// handleSetLan — N°315 (D-B1 brique 2) — POST /v1/set-lan
// {"name":"r-…","lan":"192.168.88.0/24"} : wg-peer.sh set-lan étend
// l'AllowedIPs du PEER ROUTEUR dans wg0.conf («10.8.0.N/32, <lan>») +
// syncconf à chaud — la VM route désormais le sous-réseau LAN vers ce
// routeur (cryptokey routing). PREUVE PAR LA CONF : l'AllowedIPs du peer
// est RELU dans wg0.conf après le geste et renvoyé (« allowed ») — le
// backend vérifie qu'il contient le cidr demandé avant d'accepter le geste
// (jamais de confiance aveugle à un exit code).
func handleSetLan(w http.ResponseWriter, r *http.Request) {
        var req struct {
                Name string `json:"name"`
                Lan  string `json:"lan"`
        }
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                fail(w, http.StatusBadRequest, "corps invalide")
                return
        }
        name := strings.TrimSpace(req.Name)
        lan := strings.TrimSpace(req.Lan)
        if !routerNameRe.MatchString(name) || strings.HasPrefix(name, "vpn-") {
                fail(w, http.StatusBadRequest, "nom de peer routeur invalide (minuscules/chiffres/tirets, sans préfixe vpn-)")
                return
        }
        if !validLanCIDR(lan) {
                fail(w, http.StatusBadRequest, "sous-réseau LAN invalide (/24 privé RFC1918 attendu, hors 10.8.0.0/16 — ex. 192.168.88.0/24)")
                return
        }
        start := time.Now()
        if _, err := runScript(r.Context(), "set-lan", name, lan); err != nil {
                log.Printf("[set-lan] %s échec (%s) : %v", name, time.Since(start).Round(time.Millisecond), err)
                fail(w, http.StatusBadGateway, err.Error())
                return
        }
        allowed := peerAllowedIPs(name)
        // Preuve par la conf : le cidr doit figurer PARMI LES ITEMS de l'AllowedIPs
        // relu (comparaison exacte par item — jamais une sous-chaîne approximative).
        lanPresent := false
        for _, it := range strings.Split(allowed, ",") {
                if strings.TrimSpace(it) == lan {
                        lanPresent = true
                        break
                }
        }
        if !lanPresent {
                log.Printf("[set-lan] %s geste exécuté mais AllowedIPs relu sans %s — wg-peer.sh avarié ?", name, lan)
                fail(w, http.StatusInternalServerError, "AllowedIPs du peer sans le sous-réseau demandé — vérifiez wg-peer.sh sur la VM")
                return
        }
        log.Printf("[set-lan] %s ok (%s, %s)", name, lan, time.Since(start).Round(time.Millisecond))
        writeJSON(w, http.StatusOK, map[string]any{"ok": true, "name": name, "lan": lan, "allowed": allowed})
}

// handleLanExtend — N°315 — POST /v1/lan-extend
// {"name":"vpn-…","lan":"192.168.88.0/24"} : wg-peer.sh lan-extend réécrit
// l'AllowedIPs de la CONF CLIENTE d'un peer remote (10.8.0.0/24,
// 10.8.2.0/24, <lan> — les autres LAN déjà étendus préservés), puis la conf
// FRAÎCHE est relue et renvoyée INTEGRALEMENT : le cloud remplace sa copie
// chiffrée par cette vérité VM — la réponse EST la preuve (forme remote
// intacte + cidr présent + jamais 0.0.0.0/0, vérifié ici ET côté backend).
func handleLanExtend(w http.ResponseWriter, r *http.Request) {
        var req struct {
                Name string `json:"name"`
                Lan  string `json:"lan"`
        }
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
                fail(w, http.StatusBadRequest, "corps invalide")
                return
        }
        name := strings.TrimSpace(req.Name)
        lan := strings.TrimSpace(req.Lan)
        if !nameRe.MatchString(name) {
                fail(w, http.StatusBadRequest, "nom de peer invalide (attendu vpn-… minuscules/tirets)")
                return
        }
        if !validLanCIDR(lan) {
                fail(w, http.StatusBadRequest, "sous-réseau LAN invalide (/24 privé RFC1918 attendu, hors 10.8.0.0/16 — ex. 192.168.88.0/24)")
                return
        }
        start := time.Now()
        if _, err := runScript(r.Context(), "lan-extend", name, lan); err != nil {
                log.Printf("[lan-extend] %s échec (%s) : %v", name, time.Since(start).Round(time.Millisecond), err)
                fail(w, http.StatusBadGateway, err.Error())
                return
        }
        raw, err := os.ReadFile(confPath(name))
        if err != nil {
                log.Printf("[lan-extend] %s étendu mais conf illisible : %v", name, err)
                fail(w, http.StatusInternalServerError, "conf illisible après extension — vérifiez "+peersDir)
                return
        }
        conf := string(raw)
        if !strings.Contains(conf, "AllowedIPs = 10.8.0.0/24, 10.8.2.0/24") || !strings.Contains(conf, lan) || strings.Contains(conf, "0.0.0.0/0") {
                log.Printf("[lan-extend] %s conf relue non conforme (forme remote ou cidr) — wg-peer.sh avarié ?", name)
                fail(w, http.StatusInternalServerError, "conf sans l'extension LAN attendue (forme remote + cidr) — vérifiez wg-peer.sh sur la VM")
                return
        }
        log.Printf("[lan-extend] %s ok (%s, %s)", name, lan, time.Since(start).Round(time.Millisecond))
        writeJSON(w, http.StatusOK, map[string]any{
                "ok":   true,
                "name": name,
                "lan":  lan,
                "ip":   parseIPFromConf(conf),
                "conf": conf,
                "_":    "lan étendu", // trace courte (la conf ne se logue JAMAIS)
        })
}

// ---------------------------------------------------------------------------
// Serveur
// ---------------------------------------------------------------------------

// signed — lit le corps (borné à 8 Ko), vérifie la HMAC puis remet le corps
// en place pour le handler.
func signed(next http.HandlerFunc) http.HandlerFunc {
        return func(w http.ResponseWriter, r *http.Request) {
                body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 8<<10))
                if err != nil {
                        fail(w, http.StatusRequestEntityTooLarge, "corps trop volumineux ou illisible")
                        return
                }
                if !authorized(r, body) {
                        log.Printf("[refus] signature HMAC invalide depuis %s", r.RemoteAddr)
                        fail(w, http.StatusUnauthorized, "signature invalide")
                        return
                }
                r.Body = io.NopCloser(strings.NewReader(string(body)))
                next(w, r)
        }
}

func main() {
        if secret == "" || len(secret) < 32 {
                log.Fatal("WG_MINI_SECRET absent ou trop court (32 caractères minimum) — cf. /etc/mikcloud/wg-mini.env")
        }
        if _, err := os.Stat(scriptPath); err != nil {
                log.Printf("[démarrage] attention : %s introuvable (%v) — les gestes échoueront", scriptPath, err)
        }
        mux := http.NewServeMux()
        mux.HandleFunc("POST /v1/add", signed(handleAdd))
        mux.HandleFunc("POST /v1/guest-add", signed(handleGuestAdd))
        mux.HandleFunc("POST /v1/add-router", signed(handleAddRouter))
        mux.HandleFunc("POST /v1/remove", signed(handleRemove))
        mux.HandleFunc("POST /v1/set-lan", signed(handleSetLan))
        mux.HandleFunc("POST /v1/lan-extend", signed(handleLanExtend))
        mux.HandleFunc("GET /v1/conf", signed(handleConf))
        mux.HandleFunc("GET /v1/list", signed(handleList))
        mux.HandleFunc("GET /v1/ping", signed(handlePing))
        srv := &http.Server{
                Addr:              addr,
                Handler:           mux,
                ReadHeaderTimeout: 5 * time.Second,
                ReadTimeout:       15 * time.Second,
                WriteTimeout:      30 * time.Second,
                IdleTimeout:       60 * time.Second,
        }
        ln, err := net.Listen("tcp", addr)
        if err != nil {
                log.Fatalf("écoute %s impossible : %v", addr, err)
        }
        log.Printf("wg-mini %s à l'écoute sur %s (script=%s peers=%s)", version, addr, scriptPath, peersDir)
        log.Fatal(srv.Serve(ln))
}
