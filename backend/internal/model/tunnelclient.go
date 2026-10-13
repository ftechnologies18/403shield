// TunnelClient — N°313 — compte client LÉGER de la future console « tunnel »
// (Programme Tunnel, décision D-T2) : l'acheteur B2C de la vitrine /vpn vit
// aujourd'hui SANS compte (e-mail + référence MCV-, récupération self-service)
// — le volet « espace client » de la phase 2 aura besoin d'une identité
// durable qui n'est NI un AdminUser (les gérants SaaS) NI un membre d'équipe.
//
// La table dédiée tunnel_clients est LA frontière : jamais dans admin_users
// (dette des doublons déjà consignée), aucun rôle console, aucun compte SaaS.
// Authentification v1 : code à 6 chiffres par e-mail (mot de passe oublié =
// le même parcours — il n'y a pas de mot de passe). Le client est créé À LA
// PREMIÈRE vérification réussie (inscription = connexion, passwordless) ;
// la commande B2C d'un visiteur sans compte reste possible en parallèle
// (doctrine N°301 inchangée : l'e-mail de facturation fait l'appariement,
// l'espace rattache les commandes par e-mail égal, sans fusion destructive).
//
// Statuts : active (défaut) | blocked (blocage manuel plateforme — le token
// 24 h tombe naturellement, la vérification suivante refuse).
package model

import (
	"strings"
)

// Statuts d'un client tunnel.
const (
	TunnelClientActive  = "active"
	TunnelClientBlocked = "blocked"
)

// TunnelClient — ligne du registre des clients de la console tunnel
// (table « tunnel_clients »). Aucun secret : pas de mot de passe, pas de
// hash — le code à usage unique vit en mémoire API (TTL 10 min), jamais en
// base (miroir du « state SANS colonne » de ppp_provision N°310).
type TunnelClient struct {
	ID string `json:"id"`
	// Email — identifiant UNIQUE du client (minuscules, trim). Sert
	// d'appariement aux commandes B2C (PublicVpnOrder.Email) et de
	// destination des codes de connexion.
	Email string `json:"email"`
	// Phone — optionnel, chiffres E.164 sans « + » (discipline
	// Account.Phone) — réservé au futur parcours Wave (renouvellement
	// 1-clic de la phase 2), vide en v1.
	Phone string `json:"phone,omitempty"`
	// Status — active | blocked.
	Status string `json:"status"`
	// CreatedAt / UpdatedAt — RFC3339 (NowISO).
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// TunnelClientEmailKey — forme canonique d'un e-mail client (trim + minuscules).
func TunnelClientEmailKey(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// FindTunnelClientByEmail — client par e-mail canonique (nil si absent).
func FindTunnelClientByEmail(db *DB, email string) *TunnelClient {
	key := TunnelClientEmailKey(email)
	if key == "" {
		return nil
	}
	for i := range db.TunnelClients {
		if db.TunnelClients[i].Email == key {
			return &db.TunnelClients[i]
		}
	}
	return nil
}

// FindTunnelClientByID — client par ID exact (nil si absent).
func FindTunnelClientByID(db *DB, id string) *TunnelClient {
	if id == "" {
		return nil
	}
	for i := range db.TunnelClients {
		if db.TunnelClients[i].ID == id {
			return &db.TunnelClients[i]
		}
	}
	return nil
}

// TunnelClientEmailTaken — l'e-mail est-il déjà porté ? (verrou d'unicité à
// l'insertion, miroir PublicVpnOrderPendingForEmail).
func TunnelClientEmailTaken(db *DB, email string) bool {
	return FindTunnelClientByEmail(db, email) != nil
}

// MaxTunnelClients — plafond honnête v1 du registre (garde-fou mémoire et
// base, même doctrine que MaxPublicVpnActiveOrders : la vraie borne produit
// viendra avec les formules de la phase 2).
const MaxTunnelClients = 10000
