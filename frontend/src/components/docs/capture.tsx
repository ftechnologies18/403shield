"use client";

// Cadre de capture /docs/guides (N°304) : image paresseuse à ratio réservé
// (zéro CLS via width/height intrinsèques), légende, et zoom plein écran
// au clic (dialog) — le réflexe « documentation moderne ».

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Expand, MonitorSmartphone } from "lucide-react";
import type { GuideCapture } from "@/lib/docs/types";

export function Capture({ capture }: { capture: GuideCapture }) {
  const [zoom, setZoom] = useState(false);
  const isMobile = capture.width <= 500;

  return (
    <figure className="docs-capture group my-5">
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${capture.alt} — agrandir`}
      >
        <Image
          src={capture.src}
          alt={capture.alt}
          width={capture.width}
          height={capture.height}
          sizes="(max-width: 768px) 100vw, 640px"
          className="h-auto w-full"
          loading="lazy"
        />
        <span className="pointer-events-none absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-md border border-border/70 bg-background/85 px-2 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
          {isMobile ? <MonitorSmartphone className="size-3.5" aria-hidden /> : <Expand className="size-3.5" aria-hidden />}
          {isMobile ? "Mobile" : "Agrandir"}
        </span>
      </button>
      {capture.caption ? (
        <figcaption className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
          {capture.caption}
        </figcaption>
      ) : null}

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-6xl border-border/70 p-3 sm:p-4">
          <DialogTitle className="sr-only">{capture.alt}</DialogTitle>
          <DialogDescription className="sr-only">{capture.caption ?? capture.alt}</DialogDescription>
          <div className="max-h-[80vh] overflow-auto rounded-lg bg-muted/40">
            <Image
              src={capture.src}
              alt={capture.alt}
              width={capture.width}
              height={capture.height}
              sizes="90vw"
              className="h-auto w-full"
            />
          </div>
        </DialogContent>
      </Dialog>
    </figure>
  );
}
