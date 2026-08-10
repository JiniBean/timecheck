import { readUserJson, writeUserJson } from "./clientStorage";

export type WorkTab = "main" | "ot";

const TAB_SCOPE = "mobile-work-tab";
const WORK_TABS: readonly WorkTab[] = ["main", "ot"];

function isWorkTab(value: unknown): value is WorkTab {
  return typeof value === "string" && (WORK_TABS as readonly string[]).includes(value);
}

export function readMobileWorkTab(userId: number): WorkTab {
  const saved = readUserJson<unknown>(TAB_SCOPE, userId);
  return isWorkTab(saved) ? saved : "main";
}

export function writeMobileWorkTab(userId: number, tab: WorkTab): void {
  writeUserJson(TAB_SCOPE, userId, tab);
}
