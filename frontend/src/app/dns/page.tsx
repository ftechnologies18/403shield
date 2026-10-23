"use client";

// N°347 — /dns : page marketing du bouclier DNS TOURACO du site unifié
// 403Shield (miroir de /vpn, N°317). Page publique SANS garde de
// session/PWA : visitable même connecté. Le bouclier est UTILISABLE
// GRATUITEMENT (console /dns) ; l'abonnement TOURACO s'achète sur la
// caisse du site (/checkout?product=dns — modèle OVH : on commande sur
// www, on gère dans le manager).

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProductPage from "@/components/landing/product-page";
import SignupModal from "@/components/landing/signup-modal";

export default function DnsPage() {
  const router = useRouter();
  const [signupOpen, setSignupOpen] = useState(false);

  return (
    <main className="min-h-screen">
      <ProductPage
        page="dns"
        onSignIn={() => router.push("/login")}
        onSignUp={() => setSignupOpen(true)}
      />
      {/* SignupModal global — ouvrable depuis la page produit. */}
      <SignupModal open={signupOpen} onOpenChange={setSignupOpen} />
    </main>
  );
}
