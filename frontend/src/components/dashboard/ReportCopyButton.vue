<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  copy: [];
}>();

const showToast = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function handleClick() {
  emit("copy");
  showToast.value = true;
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    showToast.value = false;
  }, 2000);
}
</script>

<template>
  <div class="actions">
    <Transition name="toast-fade">
      <span v-if="showToast" class="toast" role="status">복사되었습니다</span>
    </Transition>
    <button type="button" class="button button-outline copy-btn" :disabled="disabled" @click="handleClick">복사</button>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.toast {
  font-size: var(--font-sm);
  color: #16a34a;
  white-space: nowrap;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}

.copy-btn {
  flex-shrink: 0;
  padding: 8px 12px;
  font-size: var(--font-sm);
}
</style>
