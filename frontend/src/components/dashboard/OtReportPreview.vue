<script setup lang="ts">
import { computed, ref } from "vue";
import type { WeeklyReport } from "../../types/dashboard";
import { copyReportToClipboard } from "../../utils/reportClipboard";
import { buildOtReport } from "../../utils/ot";

interface TodayOtContext {
  extra1: number;
  extra2: number;
  otStart: string | null;
  otEnd: string | null;
  remark: string | null;
}

const props = defineProps<{
  weeklyReport: WeeklyReport;
  todayWorkDate: string;
  todayOtContext?: TodayOtContext;
  useLiveToday: boolean;
  hidden?: boolean;
}>();

const copyRootRef = ref<HTMLElement | null>(null);
const showCopyToast = ref(false);
let copyToastTimer: ReturnType<typeof setTimeout> | null = null;

const built = computed(() =>
  buildOtReport(props.weeklyReport, {
    todayWorkDate: props.todayWorkDate,
    todayOtContext: props.todayOtContext,
    useLiveToday: props.useLiveToday
  })
);

const hasRows = computed(() => built.value.rows.length > 0);

async function handleCopy() {
  if (!copyRootRef.value || !hasRows.value) {
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
    console.error(error);
  }
}

defineExpose({ copy: handleCopy, hasRows });
</script>

<template>
  <div v-if="hidden" class="dashboard-report-hidden" aria-hidden="true">
    <div ref="copyRootRef" class="preview copy-content">
      <p class="title-line">{{ built.titleLine }}</p>

      <table class="table" aria-label="시간외근무 실적 표">
        <colgroup>
          <col class="col-week" />
          <col class="col-date" />
          <col class="col-start" />
          <col class="col-end" />
          <col class="col-duration" />
          <col class="col-type" />
          <col class="col-detail" />
          <col class="col-note" />
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2">주차</th>
            <th rowspan="2" class="date-cell">수행일</th>
            <th colspan="2">수행시간</th>
            <th rowspan="2">소요시간</th>
            <th rowspan="2">근무형태</th>
            <th rowspan="2">근무내역</th>
            <th rowspan="2">비고</th>
          </tr>
          <tr>
            <th>시작</th>
            <th>종료</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!hasRows">
            <td colspan="8" class="empty">이번 주 시간외근무 기록이 없습니다.</td>
          </tr>
          <tr v-for="(row, index) in built.rows" :key="`${row.performDate}-${row.workType}-${index}`">
            <td>{{ row.weekLabel }}</td>
            <td class="date-cell">{{ row.performDate }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
            <td>{{ row.durationLabel }}</td>
            <td>{{ row.workType }}</td>
            <td class="detail-cell">{{ row.workDetail }}</td>
            <td>{{ row.note }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <section v-else class="card">
    <div class="head">
      <h2 class="card-title">시간외근무 보고서</h2>
      <div class="copy-actions">
        <Transition name="toast-fade">
          <span v-if="showCopyToast" class="toast" role="status">복사되었습니다</span>
        </Transition>
        <button type="button" class="button button-outline copy-btn" :disabled="!hasRows" @click="handleCopy">
          복사
        </button>
      </div>
    </div>

    <div ref="copyRootRef" class="preview copy-content">
      <p class="title-line">{{ built.titleLine }}</p>

      <table class="table" aria-label="시간외근무 실적 표">
        <colgroup>
          <col class="col-week" />
          <col class="col-date" />
          <col class="col-start" />
          <col class="col-end" />
          <col class="col-duration" />
          <col class="col-type" />
          <col class="col-detail" />
          <col class="col-note" />
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2">주차</th>
            <th rowspan="2" class="date-cell">수행일</th>
            <th colspan="2">수행시간</th>
            <th rowspan="2">소요시간</th>
            <th rowspan="2">근무형태</th>
            <th rowspan="2">근무내역</th>
            <th rowspan="2">비고</th>
          </tr>
          <tr>
            <th>시작</th>
            <th>종료</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!hasRows">
            <td colspan="8" class="empty">이번 주 시간외근무 기록이 없습니다.</td>
          </tr>
          <tr v-for="(row, index) in built.rows" :key="`${row.performDate}-${row.workType}-${index}`">
            <td>{{ row.weekLabel }}</td>
            <td class="date-cell">{{ row.performDate }}</td>
            <td>{{ row.startTime }}</td>
            <td>{{ row.endTime }}</td>
            <td>{{ row.durationLabel }}</td>
            <td>{{ row.workType }}</td>
            <td class="detail-cell">{{ row.workDetail }}</td>
            <td>{{ row.note }}</td>
          </tr>
        </tbody>
      </table>
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
}

.title-line {
  margin: 0 0 8px;
  font-size: var(--font-sm);
  line-height: 1.5;
  color: #334155;
}

.table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 980px;
  min-width: 980px;
  border: 2px solid #222;
  background: #fff;
  font-family: "Malgun Gothic", "맑은 고딕", sans-serif;
  font-size: 10pt;
  font-variant-numeric: tabular-nums;
}

.col-date {
  width: 130px;
}

.col-week {
  width: 90px;
}

.col-start,
.col-end {
  width: 70px;
}

.col-duration,
.col-type {
  width: 80px;
}

.col-detail {
  width: 420px;
}

.col-note {
  width: 180px;
}

.table th,
.table td {
  border: 1.5px solid #222;
  padding: 6px 4px;
  text-align: center;
  vertical-align: middle;
  word-break: keep-all;
}

.date-cell {
  white-space: nowrap;
}

.detail-cell {
  text-align: left;
  white-space: normal;
  word-break: break-word;
}

.empty {
  color: #94a3b8;
  font-size: var(--font-sm);
  padding: 12px 6px;
}
</style>
