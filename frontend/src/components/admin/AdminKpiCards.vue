<script setup lang="ts">
import { computed } from "vue";
import type { Overview, Period } from "../../types/admin";

const props = defineProps<{
  overview: Overview | null;
  loading: boolean;
  period: Period;
  weeklyGoalMetUsers: number;
  weeklyGoalRate: number;
}>();

function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

const goalHint = computed(() => {
  switch (props.period) {
    case "month":
      return "이번 달 기록일 ≥ 근무일";
    case "all":
      return "전체 기간 누적";
    default:
      return "이번 주 MAIN ≥ BASE";
  }
});
</script>

<template>
  <div class="admin-kpi-layout">
    <article class="card admin-kpi-summary-card">
      <div class="stat-row stat-row--4">
        <div class="stat-item">
          <p class="stat-label">전체 사용자</p>
          <p class="stat-value admin-kpi-value" :class="{ 'admin-kpi-value--skeleton': loading }">
            {{ loading || !overview ? "" : overview.totalUsers }}
          </p>
        </div>
        <div class="stat-item stat-item--divider">
          <p class="stat-label">신규 가입</p>
          <p class="stat-value admin-kpi-value" :class="{ 'admin-kpi-value--skeleton': loading }">
            {{ loading || !overview ? "" : overview.newUsers }}
          </p>
        </div>
        <div class="stat-item stat-item--divider">
          <p class="stat-label">활성 사용자</p>
          <p class="stat-value admin-kpi-value" :class="{ 'admin-kpi-value--skeleton': loading }">
            {{ loading || !overview ? "" : overview.activeUsers }}
          </p>
        </div>
        <div class="stat-item stat-item--divider">
          <p class="stat-label">미사용 사용자</p>
          <p
            class="stat-value admin-kpi-value admin-kpi-value--warn"
            :class="{ 'admin-kpi-value--skeleton': loading }"
          >
            {{ loading || !overview ? "" : overview.inactiveUsers }}
          </p>
        </div>
      </div>
    </article>

    <div class="admin-kpi-grid admin-kpi-grid--3">
      <article class="card admin-kpi-card">
        <p class="stat-label">도입률</p>
        <p class="stat-value admin-kpi-value" :class="{ 'admin-kpi-value--skeleton': loading }">
          {{ loading || !overview ? "" : formatRate(overview.adoptionRate) }}
        </p>
        <p class="admin-kpi-hint">기록 1회 이상 / 전체</p>
      </article>
      <article class="card admin-kpi-card">
        <p class="stat-label">출근 기록률</p>
        <p class="stat-value admin-kpi-value" :class="{ 'admin-kpi-value--skeleton': loading }">
          {{ loading || !overview ? "" : formatRate(overview.checkInRate) }}
        </p>
        <p class="admin-kpi-hint">일반근무일 RAW_START</p>
      </article>
      <article class="card admin-kpi-card">
        <p class="stat-label">주간 목표 달성</p>
        <p class="stat-value admin-kpi-value" :class="{ 'admin-kpi-value--skeleton': loading }">
          {{
            loading || !overview
              ? ""
              : `${weeklyGoalMetUsers}명 (${formatRate(weeklyGoalRate)})`
          }}
        </p>
        <p class="admin-kpi-hint">{{ goalHint }}</p>
      </article>
    </div>
  </div>
</template>
