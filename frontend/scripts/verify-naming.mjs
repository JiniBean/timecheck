/**
 * .cursor/rules/frontend-naming.mdc 컨벤션 정적 검사.
 * 경고 전용이므로 위반이 있어도 exit 0으로 종료합니다. 수정 여부는 사용자가 판단합니다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");

/** §4 유지(리네이밍 금지) 목록 */
const KEEP = new Set(["weeklyReport"]);

/** 분 값을 담는 식별자가 아닌 함수 어휘 */
const MIN_SUFFIX_ALLOW = new Set([
  "addMinutes",
  "formatMinutes",
  "minutesBetween",
  "overlapMinutes",
  "resolveBreakMinutes",
  "truncateToTenMinutes"
]);

const BOOL_PREFIX = ["is", "can", "has", "should"];

const rules = [
  {
    id: "fmt-prefix",
    pattern: /\bfmt[A-Z][\w$]*/g,
    message: "fmt* 축약 금지. format* 계열을 사용하십시오. (§3, §6)"
  },
  {
    id: "weekly-prefix",
    pattern: /\b[Ww]eekly[A-Z][\w$]*/g,
    message: "Weekly* 대신 Week* 접두를 사용하십시오. (§4)"
  },
  {
    id: "prv-abbrev",
    pattern: /\b[A-Za-z_$][\w$]*Prv[\w$]*/g,
    message: "Prv 축약 금지. Preview 풀 단어를 사용하십시오. (§4)"
  },
  {
    id: "create-empty",
    pattern: /\bcreateEmpty[A-Z][\w$]*/g,
    message: "createEmpty* 지양. empty* 팩토리 명을 사용하십시오. (§6)"
  },
  {
    id: "refresh-with",
    pattern: /\brefresh[A-Z][\w$]*With[\w$]*/g,
    message: "refresh*With* 지양. with*/sync* 계열로 정리하십시오. (§6)"
  },
  {
    id: "normalize-after",
    pattern: /\bnormalize[A-Z][\w$]*After[\w$]*/g,
    message: "normalize*After* 지양. recalcAnchors 등으로 통합하십시오. (§6)"
  },
  {
    id: "min-suffix-var",
    pattern: /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:Minutes|Mins))\b/g,
    capture: 1,
    message: "분 단위 값은 *Min 접미로 통일하십시오. (§3)"
  },
  {
    id: "min-suffix-field",
    pattern: /^\s*([a-z$][\w$]*(?:Minutes|Mins))\??\s*:/g,
    capture: 1,
    message: "분 단위 필드는 *Min 접미로 통일하십시오. (§3)"
  },
  {
    id: "bool-prefix",
    pattern: /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*ref\(\s*(?:true|false)\s*\)/g,
    capture: 1,
    message: "boolean ref는 is/can/has/should 접두를 사용하십시오. (§2)"
  }
];

/** .vue 스타일 블록 제거. 라인 번호 유지를 위해 빈 줄로 치환 */
function stripStyle(text) {
  return text.replace(/<style[\s\S]*?<\/style>/g, (block) => "\n".repeat(countLines(block)));
}

function countLines(text) {
  return text.split("\n").length - 1;
}

function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectFiles(full));
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".vue")) {
      files.push(full);
    }
  }
  return files;
}

function isSuppressed(lines, index) {
  const current = lines[index] ?? "";
  const previous = index > 0 ? lines[index - 1] : "";
  return current.includes("naming-ok") || previous.includes("naming-ok");
}

function isAllowed(rule, token) {
  if (KEEP.has(token)) {
    return true;
  }
  if (rule.id.startsWith("min-suffix") && MIN_SUFFIX_ALLOW.has(token)) {
    return true;
  }
  if (rule.id === "bool-prefix") {
    return BOOL_PREFIX.some((prefix) => token.startsWith(prefix) && token.length > prefix.length);
  }
  return false;
}

const files = collectFiles(srcDir);
const warnings = [];

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const text = file.endsWith(".vue") ? stripStyle(raw) : raw;
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    if (isSuppressed(lines, index)) {
      return;
    }
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(line)) !== null) {
        const token = rule.capture ? match[rule.capture] : match[0];
        if (isAllowed(rule, token)) {
          continue;
        }
        warnings.push({
          file: relative(root, file).replace(/\\/g, "/"),
          line: index + 1,
          rule: rule.id,
          token,
          message: rule.message
        });
      }
    }
  });
}

if (warnings.length === 0) {
  console.log(`네이밍 검사 통과: ${files.length}개 파일, 경고 없음`);
  process.exit(0);
}

for (const item of warnings) {
  console.warn(`${item.file}:${item.line} [${item.rule}] ${item.token} - ${item.message}`);
}
console.warn(
  `\n네이밍 경고 ${warnings.length}건 (${files.length}개 파일 검사). 경고 전용이므로 빌드를 막지 않습니다.`
);
console.warn("수정 여부는 사용자 판단이 필요합니다. 의도된 예외는 해당 줄에 naming-ok 주석을 남기십시오.");
process.exit(0);
