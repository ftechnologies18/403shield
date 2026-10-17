"use client";

/* ============================================================
   REVEAL — apparition au scroll (partagé landing + pages produit)
   ------------------------------------------------------------
   N°317 — extrait de landing-page.tsx pour être réutilisé par les
   pages produit du site unifié (/hotspot, /vpn, /tunnels) : même
   animation, même respect de prefers-reduced-motion (rendu statique,
   aucun mouvement).
   ============================================================ */

import { motion, useReducedMotion } from "framer-motion";

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
