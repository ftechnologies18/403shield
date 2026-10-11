// pg_settings_sql_test.go — N°56 : garde-fou statique de l'UPSERT settings.
//
// Contexte (incident découvert pendant N°56) : l'ajout des colonnes
// hospitalité (N°55) avait étendu la liste des colonnes SANS dupliquer le
// premier placeholder — 31 colonnes pour 30 expressions → chaque Exec
// échouait côté PostgreSQL (« INSERT has more target columns than
// expressions »), donc CHAQUE Sync échouait (rollback total) et Neon ne
// recevait plus rien depuis le déploiement N°55 (régression silencieuse :
// le store logue et retente, tout le système tournant sur la mémoire).
//
// Le pattern maison de syncSettings est : id et account_id partagent le
// MÊME paramètre ($1 = accID), soit N colonnes → N expressions → N-1
// paramètres distincts ($1..$N-1) → N-1 arguments Go. Ce test lit le
// littéral SQL du fichier source et verrouille cet invariant pour empêcher
// toute récidive lors du prochain ajout de colonne settings.

package store

import (
	"os"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

func TestSyncSettingsSQLConsistency(t *testing.T) {
	// N°89 — syncSettings vit désormais dans pg_sync.go (éclatement du
	// monolithe pg.go) : le garde-fou lit le fichier qui porte le littéral.
	src, err := readSourceFile("pg_sync.go")
	if err != nil {
		t.Fatalf("lecture du source impossible : %v", err)
	}
	i := strings.Index(src, "INSERT INTO settings")
	if i < 0 {
		t.Fatal("bloc INSERT INTO settings introuvable dans pg_sync.go")
	}
	// Le littéral SQL s'arrête au prochain backtick (la clause SET EXCLUDED
	// en fait partie — elle précède la fermeture du littéral).
	close := strings.Index(src[i:], "`")
	if close < 0 {
		t.Fatal("littéral SQL non refermé")
	}
	frag := src[i : i+close]
	if !strings.Contains(frag, "ON CONFLICT") {
		t.Fatal("clause ON CONFLICT introuvable dans le littéral")
	}

	// 1) Colonnes : la liste entre la première parenthèse et VALUES.
	colsPart := frag[strings.Index(frag, "(")+1 : strings.Index(frag, "VALUES")]
	cols := []string{}
	for _, c := range strings.Split(colsPart, ",") {
		c = strings.TrimSpace(c)
		if c != "" && !strings.HasPrefix(c, "--") {
			cols = append(cols, c)
		}
	}

	// 2) Expressions : la liste entre VALUES ( et le fragment suivant.
	valsPart := frag[strings.Index(frag, "VALUES")+6:]
	valsPart = strings.TrimSpace(valsPart)
	valsPart = strings.TrimPrefix(valsPart, "(")
	valsPart = valsPart[:strings.Index(valsPart, ")")]
	exprs := []string{}
	for _, e := range strings.Split(valsPart, ",") {
		if strings.TrimSpace(e) != "" {
			exprs = append(exprs, strings.TrimSpace(e))
		}
	}

	if len(cols) == 0 || len(exprs) == 0 {
		t.Fatalf("parsing du bloc impossible (cols=%d exprs=%d)", len(cols), len(exprs))
	}
	if len(cols) != len(exprs) {
		t.Fatalf("RÉGRESSION : %d colonnes pour %d expressions VALUES — l'Exec échouera et TOUTE la synchro Neon sera annulée (rollback) — cf. incident N°55", len(cols), len(exprs))
	}

	// 3) Paramètres distincts : id et account_id partagent $1 → N-1 params.
	maxPh := 0
	phRe := regexp.MustCompile(`\$(\d+)`)
	for _, e := range exprs {
		m := phRe.FindStringSubmatch(e)
		if m == nil {
			t.Fatalf("expression sans placeholder : %q", e)
		}
		n, _ := strconv.Atoi(m[1])
		if n > maxPh {
			maxPh = n
		}
	}
	if maxPh != len(cols)-1 {
		t.Fatalf("invariant du pattern maison violé : %d colonnes attendent $1..$%d (id et account_id partagent $1), trouvé max $%d", len(cols), len(cols)-1, maxPh)
	}

	// 4) La clause SET couvre toutes les colonnes sauf id (clé du conflit).
	setCount := strings.Count(frag, "= EXCLUDED.")
	if setCount != len(cols)-1 {
		t.Fatalf("clause SET : %d lignes EXCLUDED pour %d colonnes (attendu %d = colonnes - id)", setCount, len(cols), len(cols)-1)
	}
}

// TestSettingsColonnesPariteSchemaLoadSync — N°302 : garde-fou de parité des
// colonnes settings entre les TROIS endroits qui les décrivent.
//
// Contexte (incident du 11/10 10:32, signalé par le bandeau « Mode dégradé —
// persistance suspendue ») : N°301 avait ajouté la colonne de la vitrine B2C
// avec DEUX noms — « public_vpn_shop » dans la migration de pg_schema.go et
// l'UPSERT de pg_sync.go, « platform_public_vpn_shop » dans le SELECT de
// loadSettings (pg_load.go). Au boot : l'ALTER crée public_vpn_shop, le
// SELECT échoue en 42703 sur platform_public_vpn_shop, le store classe
// l'erreur « PG injoignable » → mode dégradé mémoire seule, boucle de
// récupération condamnée à échouer. Ce test croise les trois listes (schéma
// garanti par la migration, colonnes lues, colonnes écrites) pour que la
// moindre divergence de nom soit refusée par la CI AVANT tout déploiement.
func TestSettingsColonnesPariteSchemaLoadSync(t *testing.T) {
	// ── Colonnes LUES : le SELECT de loadSettings (ancre : l'unique
	// occurrence de platform_public_vpn_shop dans pg_load.go, remontée au
	// SELECT le plus proche puis avancée jusqu'au FROM settings).
	loadSrc, err := readSourceFile("pg_load.go")
	if err != nil {
		t.Fatalf("lecture pg_load.go impossible : %v", err)
	}
	k := strings.Index(loadSrc, "platform_public_vpn_shop")
	if k < 0 {
		t.Fatal("ancre platform_public_vpn_shop introuvable dans pg_load.go — le SELECT settings a-t-il été réécrit ?")
	}
	selStart := strings.LastIndex(loadSrc[:k], "SELECT ")
	if selStart < 0 {
		t.Fatal("SELECT du bloc settings introuvable dans pg_load.go")
	}
	fromIdx := strings.Index(loadSrc[selStart:], "FROM settings")
	if fromIdx < 0 {
		t.Fatal("FROM settings introuvable dans pg_load.go")
	}
	loadCols := splitSQLCols(loadSrc[selStart+len("SELECT ") : selStart+fromIdx])

	// ── Colonnes ÉCRITES : la liste entre INSERT INTO settings ( et VALUES
	// (même extraction que TestSyncSettingsSQLConsistency).
	syncSrc, err := readSourceFile("pg_sync.go")
	if err != nil {
		t.Fatalf("lecture pg_sync.go impossible : %v", err)
	}
	i := strings.Index(syncSrc, "INSERT INTO settings")
	if i < 0 {
		t.Fatal("bloc INSERT INTO settings introuvable dans pg_sync.go")
	}
	open := strings.Index(syncSrc[i:], "(")
	valIdx := strings.Index(syncSrc[i:], "VALUES")
	if open < 0 || valIdx < 0 {
		t.Fatal("liste de colonnes de l'INSERT settings introuvable")
	}
	syncCols := splitSQLCols(syncSrc[i+open+1 : i+valIdx])

	// ── Colonnes GARANTIES : CREATE TABLE settings + tous les ALTER ADD
	// COLUMN (la migration idempotente du boot).
	schemaSrc, err := readSourceFile("pg_schema.go")
	if err != nil {
		t.Fatalf("lecture pg_schema.go impossible : %v", err)
	}
	schemaCols := map[string]bool{}
	j := strings.Index(schemaSrc, "CREATE TABLE IF NOT EXISTS settings (")
	if j < 0 {
		t.Fatal("CREATE TABLE settings introuvable dans pg_schema.go")
	}
	end := strings.Index(schemaSrc[j:], "\n                )`")
	if end < 0 {
		// Retombade : fermeture générique du littéral.
		end = strings.Index(schemaSrc[j:], ")`")
	}
	for _, line := range strings.Split(schemaSrc[j:j+end], "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "--") || strings.HasPrefix(line, "CREATE") || strings.HasPrefix(line, ")") {
			continue
		}
		name := strings.Fields(line)[0]
		schemaCols[name] = true
	}
	addRe := regexp.MustCompile(`ALTER TABLE\s+settings\s+ADD COLUMN IF NOT EXISTS\s+(\w+)`)
	for _, m := range addRe.FindAllStringSubmatch(schemaSrc, -1) {
		schemaCols[m[1]] = true
	}
	if len(schemaCols) < 10 {
		t.Fatalf("parseur schéma cassé : seulement %d colonnes settings trouvées", len(schemaCols))
	}

	// ── Invariant 1 : lecture et écriture décrivent les MÊMES colonnes
	// (l'UPSERT porte « id » en plus, clé du conflit partagée avec $1).
	syncSet := map[string]bool{}
	for _, c := range syncCols {
		syncSet[c] = true
	}
	loadSet := map[string]bool{}
	for _, c := range loadCols {
		loadSet[c] = true
	}
	delete(syncSet, "id")
	if len(syncSet) != len(loadSet) {
		t.Fatalf("RÉGRESSION : %d colonnes lues contre %d écrites — lecture et écriture divergent (cf. incident N°302 : public_vpn_shop vs platform_public_vpn_shop)", len(loadSet), len(syncSet))
	}
	for c := range loadSet {
		if !syncSet[c] {
			t.Fatalf("RÉGRESSION : colonne %q lue par loadSettings mais absente de l'UPSERT syncSettings — la valeur ne serait jamais persistée", c)
		}
	}

	// ── Invariant 2 : TOUTE colonne lue/écrite est garantie par la
	// migration (CREATE + ALTER ADD) — sinon 42703 au boot.
	for c := range loadSet {
		if !schemaCols[c] {
			t.Fatalf("RÉGRESSION : colonne %q lue par loadSettings mais CRÉÉE PAR AUCUNE migration de pg_schema.go — le boot tombera en 42703 puis en mode dégradé (incident N°302)", c)
		}
	}
	for c := range syncSet {
		if !schemaCols[c] {
			t.Fatalf("RÉGRESSION : colonne %q écrite par syncSettings mais CRÉÉE PAR AUCUNE migration de pg_schema.go — chaque flush échouera en rollback (incident N°55)", c)
		}
	}
}

// splitSQLCols — découpe une liste de colonnes SQL (séparées par des
// virgules, éventuellement multi-lignes avec commentaires « -- ») en noms
// nus ; les parenthèses d'ouverture/fermeture de la liste sont ignorées.
func splitSQLCols(s string) []string {
	cols := []string{}
	for _, line := range strings.Split(s, "\n") {
		if c := strings.Index(line, "--"); c >= 0 {
			line = line[:c]
		}
		for _, part := range strings.Split(line, ",") {
			part = strings.Trim(strings.TrimSpace(part), "() \t")
			if part != "" {
				cols = append(cols, part)
			}
		}
	}
	return cols
}

// readSourceFile — lit un fichier du package (les tests tournent avec le
// répertoire du package comme working directory).
func readSourceFile(name string) (string, error) {
	b, err := os.ReadFile(name)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
