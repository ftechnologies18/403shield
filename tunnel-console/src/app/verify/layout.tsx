// verify/layout.tsx — N°316 — route privée : JAMAIS indexée.
import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
