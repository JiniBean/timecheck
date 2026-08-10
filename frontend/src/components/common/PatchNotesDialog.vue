<script setup lang="ts">
import { computed } from "vue";
import type { PatchNote } from "../../types/patchNotes";
import { useDialogKeyboard } from "../../composables/useDialogKeyboard";

const props = defineProps<{
  visible: boolean;
  note: PatchNote;
}>();

const emit = defineEmits<{
  close: [];
}>();

const visibleRef = computed(() => props.visible);

function close() {
  emit("close");
}

function formatPatchDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return date;
  }
  const year = match[1];
  const month = Number(match[2]);
  const day = Number(match[3]);
  return `${year}년 ${month}월 ${day}일`;
}

useDialogKeyboard({
  open: visibleRef,
  onClose: close,
  onSubmit: close
});
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="patch-modal-overlay" @click.self="close">
      <section
        class="patch-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-modal-title"
      >
        <header class="patch-modal-header">
          <div class="patch-modal-title-row">
            <h2 id="patch-modal-title" class="patch-modal-title">업데이트 소식</h2>
            <button type="button" class="patch-modal-close" aria-label="닫기" @click="close">
              ×
            </button>
          </div>
          <p class="patch-modal-meta">
            <span class="patch-modal-badge">v{{ note.version }}</span>
            <span class="patch-modal-meta-sep" aria-hidden="true">·</span>
            <span class="patch-modal-date">{{ formatPatchDate(note.date) }}</span>
          </p>
        </header>

        <ul class="patch-modal-list">
          <li v-for="(item, index) in note.items" :key="index">{{ item }}</li>
        </ul>

        <footer class="patch-modal-footer">
          <button type="button" class="button button-primary patch-modal-confirm" @click="close">
            확인
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.patch-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: var(--color-overlay);
}

.patch-modal-card {
  width: min(100%, 420px);
  max-height: calc(100vh - 48px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  background-color: var(--color-surface);
  box-shadow: 0 16px 40px var(--color-shadow-modal);
}

.patch-modal-header {
  padding: 22px 22px 16px;
}

.patch-modal-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.patch-modal-title {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-title);
  font-weight: var(--weight-bold);
  line-height: 1.35;
}

.patch-modal-close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin: -4px -6px 0 0;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-placeholder);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.patch-modal-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 0;
}

.patch-modal-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background-color: var(--color-surface-subtle);
  color: var(--color-text-tertiary);
  font-size: var(--font-xs);
  font-weight: var(--weight-semibold);
}

.patch-modal-meta-sep {
  color: var(--color-text-placeholder);
  font-size: var(--font-sm);
}

.patch-modal-date {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.patch-modal-list {
  margin: 0;
  padding: 4px 22px;
  list-style: none;
  overflow-y: auto;
}

.patch-modal-list li {
  --patch-item-pad-y: 8px;
  position: relative;
  padding: var(--patch-item-pad-y) 0 var(--patch-item-pad-y) 16px;
  color: var(--color-text-secondary);
  font-size: var(--font-base);
  line-height: 1.55;
  white-space: pre-line;
}

.patch-modal-list li::before {
  content: "";
  position: absolute;
  top: var(--patch-item-pad-y);
  left: 0;
  width: 5px;
  height: 5px;
  margin-top: calc((1em * 1.55 - 5px) / 2);
  border-radius: 50%;
  background-color: var(--color-text-placeholder);
}

.patch-modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 22px 22px;
}

.patch-modal-confirm {
  width: auto;
  min-width: 88px;
  justify-content: center;
}

@media (min-width: 768px) {
  .patch-modal-card {
    width: min(100%, 560px);
  }

  .patch-modal-header {
    padding: 28px 28px 20px;
  }

  .patch-modal-list {
    padding: 6px 28px;
  }

  .patch-modal-list li {
    --patch-item-pad-y: 10px;
    padding-left: 18px;
    font-size: var(--font-md);
  }

  .patch-modal-footer {
    padding: 20px 28px 28px;
  }
}
</style>
