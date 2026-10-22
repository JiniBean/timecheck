import { applyPreview, checkIn, checkOut, patchWork, type WorkPatch } from "../api/dashboard";
import type { Work } from "../types/dashboard";
import { isNetworkError } from "./apiError";
import { readUserJson, writeUserJson } from "./clientStorage";

const QUEUE_SCOPE = "write-queue";

export type WriteOp = "in" | "out" | "patch" | "apply-prv";

export type ApplyPreviewBody = Array<Pick<Work, "workDate" | "rawStart" | "rawEnd" | "mainEnd">>;

export interface WriteQueueItem {
  id: string;
  createdAt: string;
  op: WriteOp;
  workDate?: string;
  body: WorkPatch | ApplyPreviewBody;
  status: "pending" | "failed";
  lastError?: string;
}

export type WriteQueueEnqueue = Omit<WriteQueueItem, "id" | "createdAt" | "status" | "lastError">;

type FlushResult = { flushed: number; failed: number };

let flushInFlight: Promise<FlushResult> | null = null;

function readQueue(userId: number): WriteQueueItem[] {
  return readUserJson<WriteQueueItem[]>(QUEUE_SCOPE, userId) ?? [];
}

function writeQueue(userId: number, items: WriteQueueItem[]): void {
  writeUserJson(QUEUE_SCOPE, userId, items);
}

export function pendingCount(userId: number): number {
  return readQueue(userId).length;
}

export function enqueue(userId: number, item: WriteQueueEnqueue): void {
  const queue = readQueue(userId);
  if (item.workDate) {
    const index = queue.findIndex(
      (row) => row.status === "pending" && row.op === item.op && row.workDate === item.workDate,
    );
    if (index >= 0) {
      const existing = queue[index]!;
      if (item.op === "patch") {
        existing.body = { ...(existing.body as WorkPatch), ...(item.body as WorkPatch) };
      } else {
        existing.body = item.body;
      }
      existing.createdAt = new Date().toISOString();
      writeQueue(userId, queue);
      return;
    }
  }

  queue.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    op: item.op,
    workDate: item.workDate,
    body: item.body,
    status: "pending",
  });
  writeQueue(userId, queue);
}

async function replayItem(userId: number, item: WriteQueueItem): Promise<void> {
  switch (item.op) {
    case "in":
      await checkIn(userId, item.body as WorkPatch);
      return;
    case "out":
      await checkOut(userId, item.body as WorkPatch);
      return;
    case "patch":
      await patchWork(userId, item.body as WorkPatch);
      return;
    case "apply-prv":
      await applyPreview(userId, item.body as ApplyPreviewBody);
      return;
    default:
      return;
  }
}

export async function flushQueue(userId: number): Promise<FlushResult> {
  if (flushInFlight) {
    return flushInFlight;
  }

  flushInFlight = doFlush(userId).finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

async function doFlush(userId: number): Promise<FlushResult> {
  let flushed = 0;
  let failed = 0;
  const queue = readQueue(userId);
  const remaining: WriteQueueItem[] = [];

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i]!;
    try {
      await replayItem(userId, item);
      flushed += 1;
    } catch (error) {
      if (isNetworkError(error)) {
        remaining.push(...queue.slice(i));
        break;
      }
      const message = error instanceof Error && error.message.trim() ? error.message.trim() : "동기화에 실패했습니다.";
      remaining.push({ ...item, status: "failed", lastError: message });
      failed += 1;
    }
  }

  writeQueue(userId, remaining);
  return { flushed, failed };
}
