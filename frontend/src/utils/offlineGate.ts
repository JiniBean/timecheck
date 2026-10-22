let sessionFlag = false;

function onBrowserOffline(): void {
  sessionFlag = true;
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", onBrowserOffline);
  // browser online: markOnline 금지. resumeAfterReconnect의 API 성공으로만 복구.
}

export function markOffline(): void {
  sessionFlag = true;
}

export function markOnline(): void {
  sessionFlag = false;
}

export function isOfflineSession(): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }
  return sessionFlag;
}
