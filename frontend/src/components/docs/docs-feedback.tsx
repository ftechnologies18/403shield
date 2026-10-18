"use client";

// Feedback lecteur « Cette page vous a aidé ? » (N°333-D) — zéro
// infrastructure, zéro base de données : chaque réponse ouvre un mailto
// prérempli vers le canal réel de l'exploitant (identité publique du
// projet), avec l'id du guide et la réponse dans le sujet — triable,
// traçable, aucun chiffre inventé (on n'affiche pas de compteur).

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEEDBACK_EMAIL = "freelancetechnologies.ci@gmail.com";

function mailtoFor(guideId: string, answer: "oui" | "non") {
  const subject = `Feedback guide : ${guideId} — ${answer === "oui" ? "page utile" : "page à améliorer"}`;
  const body = [
    `Guide : https://403shield.ftci.fr/docs/guides/${guideId}`,
    answer === "oui"
      ? "Cette page m'a aidé. (Facultatif) Ce qui m'a le plus servi :"
      : "Cette page peut être améliorée. Ce qui manque ou me bloque :",
    "",
  ].join("\n");
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function DocsFeedback({ guideId }: { guideId: string }) {
  const [answered, setAnswered] = useState<"oui" | "non" | null>(null);

  if (answered) {
    return (
      <p className="rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm text-muted-foreground" role="status">
        Merci — votre retour part par e-mail vers l&apos;équipe de rédaction
        {answered === "non" ? " (précisez ce qui manque dans le message qui vient de s&apos;ouvrir)" : ""}.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-4 py-3">
      <p className="text-sm text-muted-foreground">Cette page vous a aidé ?</p>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-[13px]">
          <a href={mailtoFor(guideId, "oui")} onClick={() => setAnswered("oui")}>
            <ThumbsUp className="size-3.5" aria-hidden />
            Oui
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-[13px]">
          <a href={mailtoFor(guideId, "non")} onClick={() => setAnswered("non")}>
            <ThumbsDown className="size-3.5" aria-hidden />
            Non
          </a>
        </Button>
      </div>
    </div>
  );
}
