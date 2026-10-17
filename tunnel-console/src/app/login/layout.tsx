// login/layout.tsx — N°316 — route privée : JAMAIS indexée.
import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
