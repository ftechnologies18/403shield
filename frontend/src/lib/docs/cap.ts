// Fabrique de captures — chemin relatif sous /public/docs/ (N°304).
import type { GuideCapture } from "./types";

export function cap(
  path: string,
  width: number,
  height: number,
  alt: string,
  caption?: string,
): GuideCapture {
  return { src: `/docs/${path}`, alt, caption, width, height };
}
