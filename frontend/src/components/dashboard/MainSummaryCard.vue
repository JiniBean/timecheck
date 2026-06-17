<script setup lang="ts">
import { computed } from "vue";
import type { SummaryOut } from "../../utils/main";
import { fmtDurKo, fmtMinutes } from "../../utils/time";

const props = defineProps<{
  summary: SummaryOut;
  isCurrentWeek: boolean;
}>();

const emit = defineEmits<{
  openPreview: [];
}>();

const balanceLabel = computed(() => (props.summary.weekOverMin > 0 ? "남음" : "부족"));

const balanceValue = computed(() =>
  props.summary.weekOverMin > 0
    ? fmtMinutes(props.summary.weekOverMin)
    : fmtMinutes(props.summary.weekRemMin)
);

const avgDisplay = computed(() =>
  props.isCurrentWeek ? fmtDurKo(props.summary.avgPerDayMin) : "-"
);

const daysAfterDisplay = computed(() =>
  props.isCurrentWeek ? `${props.summary.daysAfter}일` : "-"
);

function openPreview() {
  emit("openPreview");
}
</script>

<template>
  <section
    class="card summary-card"
    role="button"
    tabindex="0"
    aria-label="이번 주 근무 미리보기 열기"
    @click="openPreview"
    @keydown.enter="openPreview"
    @keydown.space.prevent="openPreview"
  >
    <div class="stat-row stat-row--4">
      <div class="stat-item">
        <p class="stat-label">총 근무</p>
        <p class="stat-value">{{ fmtMinutes(summary.weekMainMin) }}</p>
      </div>
      <div class="stat-item stat-item--divider">
        <p class="stat-label">{{ balanceLabel }}</p>
        <p class="stat-value">{{ balanceValue }}</p>
      </div>
      <div class="stat-item stat-item--divider">
        <p class="stat-label">하루 평균</p>
        <p class="stat-value">{{ avgDisplay }}</p>
      </div>
      <div class="stat-item stat-item--divider">
        <p class="stat-label">남은 근무</p>
        <p class="stat-value">{{ daysAfterDisplay }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary-card {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

@media (hover: hover) and (pointer: fine) {
  .summary-card:hover {
    background-color: var(--color-surface-preview);
    box-shadow: 0 8px 22px var(--color-shadow-elevated);
  }
}

.summary-card:focus-visible {
  outline: 2px solid var(--color-primary-ring);
  outline-offset: 2px;
}
</style>
