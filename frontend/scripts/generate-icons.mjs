import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

const outputs = [
  { input: "icon.svg", output: "pwa-192x192.png", size: 192 },
  { input: "icon.svg", output: "pwa-512x512.png", size: 512 },
  { input: "icon.svg", output: "apple-touch-icon.png", size: 180 },
  { input: "icon-maskable.svg", output: "pwa-512x512-maskable.png", size: 512 }
];

for (const { input, output, size } of outputs) {
  const svg = readFileSync(join(publicDir, input));
  await sharp(svg).resize(size, size).png().toFile(join(publicDir, output));
  console.log(`generated ${output} (${size}x${size})`);
}
