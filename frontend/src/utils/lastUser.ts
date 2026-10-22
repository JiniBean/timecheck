import type { AuthUser } from "../types/auth";
import { readJson, removeJson, writeJson } from "./clientStorage";

const LAST_USER_KEY = "timecheck-last-user";

export function saveLastUser(user: AuthUser): void {
  writeJson(LAST_USER_KEY, user);
}

export function loadLastUser(): AuthUser | null {
  return readJson<AuthUser>(LAST_USER_KEY);
}

export function clearLastUser(): void {
  removeJson(LAST_USER_KEY);
}
