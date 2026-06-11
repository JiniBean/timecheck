<script setup lang="ts">
import { computed } from "vue";
import type { MainSummaryResult } from "../../utils/main";
import { formatDurationKo, formatHmFromMinutes } from "../../utils/time";

const props = defineProps<{
  summary: MainSummaryResult;
  isCurrentWeek: boolean;
}>();

const emit = defineEmits<{
  openPreview: [];
}>();

const balanceLabel = computed(() => (props.summary.weekOverMinutes > 0 ? "남음" : "부족"));

const balanceValue = computed(() =>
  props.summary.weekOverMinutes > 0
    ? formatHmFromMinutes(props.summary.weekOverMinutes)
    : formatHmFromMinutes(props.summary.weekRemainingMinutes)
);

const avgDisplay = computed(() =>
  props.isCurrentWeek ? formatDurationKo(props.summary.avgRequiredPerDayMinutes) : "-"
);

const remainingWorkDaysDisplay = computed(() =>
  props.isCurrentWeek ? `${props.summary.remainingWorkDays}일` : "-"
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
        <p class="stat-value">{{ formatHmFromMinutes(summary.weekWorkedMinutes) }}</p>
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
        <p class="stat-value">{{ remainingWorkDaysDisplay }}</p>
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
    background-color: #fafbfc;
    box-shadow: 0 8px 22px rgba(17, 24, 39, 0.08);
  }
}

.summary-card:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 2px;
}
</style>
