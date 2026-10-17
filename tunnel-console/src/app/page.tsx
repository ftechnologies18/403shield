// page.tsx — N°323 — la console devient une PURE application (modèle
// dash.cloudflare.com / manager OVH) : la racine REDIRIGE vers /login.
// La vitrine marketing (403shield.ftci.fr, refondue N°321-322) est
// l'UNIQUE landing de la marque ; la caisse (/checkout) vit aussi sur le
// site depuis N°323 (modèle OVH : commander sur www, gérer dans le
// manager). L'ancienne vitrine racine (N°313 « MikTunnel » → N°317
// rebrand) disparaît : plus de doublon marketing sur le domaine
// applicatif — un clic « Console » atterrit sur la connexion (et, pour
// un visiteur déjà connecté, /login le renvoie vers /me).
// 308 permanent : la « landing racine » de la console EST /login.

import { permanentRedirect } from "next/navigation";

export default function RootPage() {
  permanentRedirect("/login");
}
