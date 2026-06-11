<script setup lang="ts">
import { computed } from "vue";
import { formatWeekLabel } from "../../utils/weekNav";

const props = defineProps<{
  weekStart: string;
  weekEnd: string;
  isCurrentWeek: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  prev: [];
  next: [];
  thisWeek: [];
}>();

const weekLabel = computed(() => formatWeekLabel(props.weekStart));

function onCenterClick() {
  if (props.loading || props.isCurrentWeek) {
    return;
  }
  emit("thisWeek");
}

function onCenterKeydown(event: KeyboardEvent) {
  if (props.loading || props.isCurrentWeek) {
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    emit("thisWeek");
  }
}
</script>

<template>
  <div class="nav">
    <button type="button" class="btn" :disabled="loading" aria-label="이전 주" @click="emit('prev')">‹</button>
    <div
      class="center"
      :class="{ clickable: !isCurrentWeek && !loading }"
      :role="!isCurrentWeek && !loading ? 'button' : undefined"
      :tabindex="!isCurrentWeek && !loading ? 0 : undefined"
      :aria-label="!isCurrentWeek ? `${weekLabel}, 이번 주로 이동` : undefined"
      @click="onCenterClick"
      @keydown="onCenterKeydown"
    >
      <span class="label">{{ weekLabel }}</span>
    </div>
    <button type="button" class="btn" :disabled="loading" aria-label="다음 주" @click="emit('next')">›</button>
  </div>
</template>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 2px;
}

.btn {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #334155;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.center {
  padding: 6px 16px;
  border-radius: 8px;
}

.center.clickable {
  cursor: pointer;
  border: 1px solid #d1d5db;
  -webkit-tap-highlight-color: transparent;
}

.center.clickable:active {
  background-color: #f1f5f9;
}

.label {
  font-size: var(--font-base);
  font-weight: 700;
  color: #0f172a;
}
</style>
