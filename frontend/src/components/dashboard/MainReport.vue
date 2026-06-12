<script setup lang="ts">
import { computed, ref } from "vue";
import type { WeeklyReport } from "../../types/dashboard";
import { showApiError } from "../../utils/apiError";
import { copyReportToClipboard } from "../../utils/reportClipboard";
import { buildMainReport } from "../../utils/main";

const props = defineProps<{
  weeklyReport: WeeklyReport;
  todayWorkDate: string;
  todayWorkedMinutes: number;
  useLiveToday: boolean;
  hidden?: boolean;
}>();

const copyRootRef = ref<HTMLElement | null>(null);
const showCopyToast = ref(false);
let copyToastTimer: ReturnType<typeof setTimeout> | null = null;

const built = computed(() =>
  buildMainReport(props.weeklyReport, {
    todayWorkDate: props.todayWorkDate,
    todayWorkedMinutes: props.todayWorkedMinutes,
    useLiveToday: props.useLiveToday
  })
);

async function handleCopy() {
  if (!copyRootRef.value) {
    return;
  }
  try {
    await copyReportToClipboard(copyRootRef.value);
    if (!props.hidden) {
      showCopyToast.value = true;
      if (copyToastTimer) {
        clearTimeout(copyToastTimer);
      }
      copyToastTimer = setTimeout(() => {
        showCopyToast.value = false;
      }, 2000);
    }
  } catch (error) {
    showApiError(error, "복사에 실패했습니다.");
  }
}

defineExpose({ copy: handleCopy });
</script>

<template>
  <div v-if="hidden" class="dashboard-report-hidden" aria-hidden="true">
    <div ref="copyRootRef" class="preview copy-content">
      <p class="title-line">{{ built.titleLine }}</p>
      <p class="worker-line">{{ built.workerLine }}</p>

      <table class="table" aria-label="근무시간 표">
        <colgroup>
          <col style="width: 16%" />
          <col style="width: 15%" />
          <col style="width: 15%" />
          <col style="width: 19%" />
        </colgroup>
        <thead>
          <tr>
            <th>일자(요일)</th>
            <th>출근시간</th>
            <th>퇴근시간</th>
            <th>일일 근무시간</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in built.rows" :key="row.dateLabel">
            <td>{{ row.dateLabel }}</td>
            <td>{{ row.checkIn }}</td>
            <td>{{ row.checkOut }}</td>
            <td>{{ row.workLabel }}</td>
          </tr>
          <tr>
            <td colspan="3">총근무시간</td>
            <td>{{ built.totalWorkLabel }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="built.remarks.length > 0" class="remarks">
        <p class="remarks-title">비고:</p>
        <p v-for="line in built.remarks" :key="line.index" class="remarks-line">
          {{ line.index }}. {{ line.text }}
        </p>
      </div>
    </div>
  </div>

  <section v-else class="card">
    <div class="head">
      <h2 class="card-title">주간 보고서</h2>
      <div class="copy-actions">
        <Transition name="toast-fade">
          <span v-if="showCopyToast" class="toast" role="status">복사되었습니다</span>
        </Transition>
        <button type="button" class="button button-outline copy-btn" @click="handleCopy">복사</button>
      </div>
    </div>

    <div ref="copyRootRef" class="preview copy-content">
      <p class="title-line">{{ built.titleLine }}</p>
      <p class="worker-line">{{ built.workerLine }}</p>

      <table class="table" aria-label="근무시간 표">
        <colgroup>
          <col style="width: 16%" />
          <col style="width: 15%" />
          <col style="width: 15%" />
          <col style="width: 19%" />
        </colgroup>
        <thead>
          <tr>
            <th>일자(요일)</th>
            <th>출근시간</th>
            <th>퇴근시간</th>
            <th>일일 근무시간</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in built.rows" :key="row.dateLabel">
            <td>{{ row.dateLabel }}</td>
            <td>{{ row.checkIn }}</td>
            <td>{{ row.checkOut }}</td>
            <td>{{ row.workLabel }}</td>
          </tr>
          <tr>
            <td colspan="3">총근무시간</td>
            <td>{{ built.totalWorkLabel }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="built.remarks.length > 0" class="remarks">
        <p class="remarks-title">비고:</p>
        <p v-for="line in built.remarks" :key="line.index" class="remarks-line">
          {{ line.index }}. {{ line.text }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: var(--mobile-inset-gap);
}

.copy-actions {
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
  padding: 8px 12px;
  font-size: var(--font-sm);
}

.preview {
  overflow-x: auto;
  font-family: "Malgun Gothic", "맑은 고딕", sans-serif;
  font-size: 10pt;
  color: #222;
  line-height: 1.5;
}

.title-line,
.worker-line {
  margin: 0 0 8px;
}

.table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 500px;
  min-width: 500px;
  border: 1px solid #222;
  background: #fff;
  font-variant-numeric: tabular-nums;
}

.table th,
.table td {
  border: 1px solid #222;
  padding: 6px;
  text-align: center;
  white-space: pre;
}

.table th {
  font-weight: 600;
}

.remarks {
  margin-top: 12px;
}

.remarks-title {
  margin: 0 0 6px;
  font-weight: 700;
}

.remarks-line {
  margin: 0 0 4px;
}
</style>
