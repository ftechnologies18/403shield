"use client";

// N°317 — /hotspot : page marketing Hotspot du site unifié 403Shield
// (voie Cloudflare/OVH). Pattern inspiré de la vitrine (/) mais SANS
// garde de session/PWA : page publique, visitable même connecté.

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProductPage from "@/components/landing/product-page";
import SignupModal from "@/components/landing/signup-modal";

export default function HotspotPage() {
  const router = useRouter();
  const [signupOpen, setSignupOpen] = useState(false);

  return (
    <main className="min-h-screen">
      <ProductPage
        page="hotspot"
        onSignIn={() => router.push("/login")}
        onSignUp={() => setSignupOpen(true)}
      />
      {/* SignupModal global — ouvrable depuis la page produit. */}
      <SignupModal open={signupOpen} onOpenChange={setSignupOpen} />
    </main>
  );
}
