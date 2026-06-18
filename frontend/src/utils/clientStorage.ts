const STORAGE_PREFIX = "timecheck";

export function userStorageKey(scope: string, userId: number): string {
  return `${STORAGE_PREFIX}-${scope}-${userId}`;
}

export function readUserJson<T>(scope: string, userId: number): T | null {
  try {
    const raw = localStorage.getItem(userStorageKey(scope, userId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeUserJson(scope: string, userId: number, value: unknown): void {
  localStorage.setItem(userStorageKey(scope, userId), JSON.stringify(value));
}
