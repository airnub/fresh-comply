import fs from "node:fs/promises";

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const bigint = parseInt(value, 16);
  if (value.length === 6) {
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }
  throw new Error(`Unsupported color format: ${hex}`);
}

function luminance({ r, g, b }) {
  const srgb = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrast(colorA, colorB) {
  const lumA = luminance(hexToRgb(colorA));
  const lumB = luminance(hexToRgb(colorB));
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
}

const tokens = await fs.readFile("packages/ui/tokens.css", "utf-8");

function extractVariables(block) {
  const variables = new Map();
  const regex = /--([\w-]+):\s*(#[0-9a-fA-F]{6})/g;
  let match;
  while ((match = regex.exec(block))) {
    variables.set(match[1], match[2]);
  }
  return variables;
}

const rootMatch = tokens.match(/:root\s*\{([\s\S]*?)\}/);
if (!rootMatch) {
  throw new Error("Could not parse :root block in tokens.css");
}

const rootVars = extractVariables(rootMatch[1]);

const pairs = [
  { name: "surface", foreground: rootVars.get("color-foreground"), background: rootVars.get("color-surface") },
  { name: "accent", foreground: rootVars.get("color-on-accent"), background: rootVars.get("color-accent") },
  { name: "highlight", foreground: rootVars.get("color-highlight-foreground"), background: rootVars.get("color-highlight") }
];

let failures = 0;
for (const pair of pairs) {
  if (!pair.foreground || !pair.background) {
    console.warn(`Skipping ${pair.name} pair; missing variables`);
    continue;
  }
  const ratio = contrast(pair.foreground, pair.background);
  if (ratio < 4.5) {
    failures += 1;
    console.error(`Contrast for ${pair.name} is ${ratio.toFixed(2)} (<4.5)`);
  } else {
    console.log(`Contrast for ${pair.name} is ${ratio.toFixed(2)}`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
