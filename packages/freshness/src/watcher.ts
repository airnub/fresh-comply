import { SOURCES } from "./sources.js";

type WatchEvent = {
  sourceKey: keyof typeof SOURCES;
  detectedAt: string;
  summary: string;
};

export async function pollSource(sourceKey: keyof typeof SOURCES): Promise<WatchEvent | null> {
  // Placeholder: in dev we simulate no change
  return null;
}
