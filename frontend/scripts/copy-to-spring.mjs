import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const staticDir = join(root, "..", "src", "main", "resources", "static");

if (!existsSync(distDir)) {
  console.error("dist 폴더가 없습니다. 먼저 vite build를 실행하세요.");
  process.exit(1);
}

if (existsSync(staticDir)) {
  rmSync(staticDir, { recursive: true, force: true });
}

mkdirSync(staticDir, { recursive: true });
cpSync(distDir, staticDir, { recursive: true });
console.log("frontend/dist -> src/main/resources/static 복사 완료");
