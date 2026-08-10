import type { PatchNote, SeenPatch } from "../types/patchNotes";
import { readUserJson, writeUserJson } from "./clientStorage";

export const SEEN_PATCH_SCOPE = "seen-patch";

/** 최신 항목이 배열 첫 번째. version은 앱 버전 단일 소스. */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: "0.0.1",
    date: "2026-08-10",
    title: "업데이트 안내",
    items: [
      "앞으로 업데이트가 있을 때마다 이렇게 알려드릴게요.\n확인 후에는 다시 뜨지 않아요.",
      "미리보기에서 야근이 있는 날 퇴근·근무 시간이 정확해졌어요.",
      "모바일에서 마지막으로 본 일반/시간외 탭을 다음에 열어도 유지해요."
    ]
  }
];

export function latestPatchNote(): PatchNote {
  const latest = PATCH_NOTES[0];
  if (!latest) {
    throw new Error("PATCH_NOTES가 비어 있습니다.");
  }
  return latest;
}

export function markPatchSeen(userId: number, version: string): void {
  writeUserJson(SEEN_PATCH_SCOPE, userId, { version } satisfies SeenPatch);
}

/**
 * 표시할 패치노트. null이면 표시하지 않음.
 * seen이 없거나 최신과 다르면 최신 노트를 반환함. 읽음 저장은 닫기 시에만 함.
 */
export function resolvePatchNote(userId: number): PatchNote | null {
  const latest = latestPatchNote();
  const seen = readUserJson<SeenPatch>(SEEN_PATCH_SCOPE, userId);
  if (seen?.version === latest.version) {
    return null;
  }
  return latest;
}
