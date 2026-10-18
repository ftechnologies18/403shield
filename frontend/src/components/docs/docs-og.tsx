// Générateur d'og:image des pages guides (N°333-D) — style nuit clay
// 403Shield : marque « 403 · Guides », kicker de section, titre (coupe
// propre), pied FTech CI. ImageResponse (next/og) rendu AU BUILD — une
// image par guide (32), par section (9) et une pour le hub, style
// typographique sans icônes (Satori ne rend pas les SVG lucide).

import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Coupe un titre long en 2 lignes maximum (~34 caractères par ligne). */
function wrapTitle(title: string): string[] {
  if (title.length <= 34) return [title];
  const words = title.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > 36 && current !== "") {
      lines.push(current.trim());
      current = w;
    } else {
      current = `${current} ${w}`.trim();
    }
  }
  if (current) lines.push(current.trim());
  if (lines.length > 2) {
    return [lines[0], `${lines.slice(1).join(" ").slice(0, 33)}…`];
  }
  return lines;
}

export function renderDocsOg({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub: string;
}) {
  const lines = wrapTitle(title);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0B100E 0%, #101915 55%, #0C1512 100%)",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          color: "#F5F5F4",
        }}
      >
        {/* En-tête : marque */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)",
              color: "#04211C",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            403
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>403Shield</span>
            <span style={{ fontSize: 18, color: "#A8A89E" }}>Guides d&apos;exploitation</span>
          </div>
        </div>

        {/* Corps : kicker + titre */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "8px 18px",
              borderRadius: 999,
              border: "1px solid rgba(20,184,166,0.45)",
              background: "rgba(20,184,166,0.12)",
              color: "#5EEAD4",
              fontSize: 21,
              fontWeight: 600,
            }}
          >
            {kicker}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lines.map((l, i) => (
              <span
                key={i}
                style={{
                  fontSize: lines.length > 1 ? 52 : 60,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  letterSpacing: -1,
                  color: "#FAFAF9",
                }}
              >
                {l}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 24, color: "#A8A89E" }}>{sub}</span>
        </div>

        {/* Pied */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 22, color: "#8F8F86" }}>403shield.ftci.fr/docs/guides</span>
          <span style={{ fontSize: 22, color: "#8F8F86" }}>FTech CI · Abidjan</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
