"use client";

// N°317 — /vpn : page marketing VPN du site unifié 403Shield (voie
// Cloudflare/OVH). Pattern inspiré de la vitrine (/) mais SANS garde de
// session/PWA : page publique, visitable même connecté.
//
// Note : en production, vercel.json redirige /vpn?order=… (liens de
// retour GeniusPay historiques) vers la caisse /checkout du site (N°323 —
// la boutique a quitté la console) ; la page propre reste servie pour
// tout le reste.

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProductPage from "@/components/landing/product-page";
import SignupModal from "@/components/landing/signup-modal";

export default function VpnPage() {
  const router = useRouter();
  const [signupOpen, setSignupOpen] = useState(false);

  return (
    <main className="min-h-screen">
      <ProductPage
        page="vpn"
        onSignIn={() => router.push("/login")}
        onSignUp={() => setSignupOpen(true)}
      />
      {/* SignupModal global — ouvrable depuis la page produit. */}
      <SignupModal open={signupOpen} onOpenChange={setSignupOpen} />
    </main>
  );
}
