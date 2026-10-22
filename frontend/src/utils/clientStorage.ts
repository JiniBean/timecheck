const STORAGE_PREFIX = "timecheck";

export function userStorageKey(scope: string, userId: number): string {
  return `${STORAGE_PREFIX}-${scope}-${userId}`;
}

export function readUserJson<T>(scope: string, userId: number): T | null {
  return readJson<T>(userStorageKey(scope, userId));
}

export function writeUserJson(scope: string, userId: number, value: unknown): void {
  writeJson(userStorageKey(scope, userId), value);
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 프라이빗 모드·용량 초과 등에서 쓰기 실패해도 호출부를 깨지 않음
  }
}

export function removeJson(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
