<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import PunchCard from "../components/dashboard/PunchCard.vue";
import OtSummaryCard from "../components/dashboard/OtSummaryCard.vue";
import OtTableCard from "../components/dashboard/OtTableCard.vue";
import ReportCopyButton from "../components/dashboard/ReportCopyButton.vue";
import MainSummaryCard from "../components/dashboard/MainSummaryCard.vue";
import WeekNavigator from "../components/dashboard/WeekNavigator.vue";
import OtReportPreview from "../components/dashboard/OtReportPreview.vue";
import MainReport from "../components/dashboard/MainReport.vue";
import MainTable from "../components/dashboard/MainTable.vue";
import DashboardMobileTabs, { type WorkTab } from "../components/dashboard/DashboardMobileTabs.vue";
import WeekPreviewSheet from "../components/dashboard/WeekPreviewSheet.vue";
import ProfileEditDialog from "../components/auth/ProfileEditDialog.vue";
import logoutIcon from "../assets/icons/logout.svg";
import { useDashboard } from "../composables/useDashboard";
import { useAuthStore } from "../stores/auth";
import { buildOtReport } from "../utils/ot";
import { isWorkingInProgress, resolveEffectiveTodayWork, resolveWorkCalcResult } from "../utils/timeCalculator";
import { localDateKey } from "../utils/localDate";
import { computeMainSummary } from "../utils/main";

const authStore = useAuthStore();
const router = useRouter();
const userId = authStore.user!.userId;

const {
  state,
  isCurrentWeek,
  actionTimeDisplay,
  isActionTimeEditable,
  isActionTimeLocked,
  applyPickedTime,
  canCheckIn,
  canCheckOut,
  handleCheckIn,
  handleCheckOut,
  applyWorkSettings,
  updateTodayMainEnd,
  updateTodayOtStart,
  persistWorkSettings,
  updateWeeklyCheckIn,
  updateWeeklyCheckOut,
  updateWeeklyOtStart,
  updateWeeklyOtEnd,
  clearWeeklyCheckIn,
  clearWeeklyCheckOut,
  clearWeeklyOtStart,
  clearWeeklyOtEnd,
  saveWeeklyDaySettings,
  shiftWeek,
  goToThisWeek,
  loadDashboard
} = useDashboard(userId);

const profileDialogVisible = ref(false);
const weekPreviewOpen = ref(false);
const mobileWorkTab = ref<WorkTab>("main");

watch(
  () => state.value.todayWork.isOt,
  (isOt) => {
    if (isOt) {
      mobileWorkTab.value = "ot";
    }
  },
  { immediate: true }
);

async function handleLogout() {
  await authStore.logout();
  await router.replace("/login");
}

function openProfileDialog() {
  profileDialogVisible.value = true;
}

function closeProfileDialog() {
  profileDialogVisible.value = false;
}

function openWeekPreview() {
  weekPreviewOpen.value = true;
}

async function handleProfileSaved() {
  await loadDashboard();
}

const now = ref(new Date());
const workTimeNow = ref(new Date());
let clockTimerId: number | null = null;
let workTimeTimerId: number | null = null;

const weeklyReportRef = ref<{ copy: () => Promise<void> } | null>(null);
const otReportRef = ref<{ copy: () => Promise<void>; hasRows: boolean } | null>(null);

const nowLabel = computed(() =>
  now.value.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })
);

const todayDateKey = computed(() => localDateKey());

const effectiveTodayWork = computed(() =>
  resolveEffectiveTodayWork(
    state.value.todayWork,
    state.value.weeklyReport.days,
    todayDateKey.value
  )
);

function parseActionTimeAsDate(workDate: string, hhmm: string): Date {
  const [h, m] = hhmm.slice(0, 5).split(":");
  return new Date(
    `${workDate}T${String(Number(h) || 0).padStart(2, "0")}:${String(Number(m) || 0).padStart(2, "0")}:00`
  );
}

const todayPreviewTime = computed(() => {
  const work = effectiveTodayWork.value;
  if (isWorkingInProgress(work) && isCurrentWeek.value) {
    return parseActionTimeAsDate(todayDateKey.value, actionTimeDisplay.value);
  }
  return workTimeNow.value;
});

const todayLiveWork = computed(() => {
  const work = effectiveTodayWork.value;
  if (isWorkingInProgress(work) && isCurrentWeek.value) {
    return resolveWorkCalcResult(work, todayPreviewTime.value);
  }
  return resolveWorkCalcResult(work);
});

const todayWorkedMinutes = computed(() => {
  if (isWorkingInProgress(effectiveTodayWork.value) && isCurrentWeek.value) {
    return todayLiveWork.value.main;
  }
  return effectiveTodayWork.value.main;
});

const todayExtraMinutes = computed(() => ({
  extra1: todayLiveWork.value.extra1,
  extra2: todayLiveWork.value.extra2
}));

const todayOtContext = computed(() => {
  const work = effectiveTodayWork.value;
  const live = todayLiveWork.value;
  const useLive = isWorkingInProgress(work) && isCurrentWeek.value;

  return {
    extra1: live.extra1,
    extra2: live.extra2,
    otStart: useLive ? live.otStart : work.otStart ?? null,
    otEnd: useLive ? live.otEnd : work.otEnd ?? null,
    remark: work.remark
  };
});

const workSummary = computed(() =>
  computeMainSummary({
    weeklyReport: state.value.weeklyReport,
    todayWork: effectiveTodayWork.value,
    todayDateKey: todayDateKey.value,
    todayWorkedMinutes: todayWorkedMinutes.value,
    todayExtraMinutes: todayExtraMinutes.value,
    useLiveToday: isCurrentWeek.value
  })
);

const highlightTodayDate = computed(() => (isCurrentWeek.value ? todayDateKey.value : ""));

const otReportHasRows = computed(
  () =>
    buildOtReport(state.value.weeklyReport, {
      todayWorkDate: todayDateKey.value,
      todayOtContext: todayOtContext.value,
      useLiveToday: isCurrentWeek.value
    }).rows.length > 0
);

async function copyWeeklyReport() {
  await weeklyReportRef.value?.copy();
}

async function copyOtReport() {
  await otReportRef.value?.copy();
}

onMounted(() => {
  clockTimerId = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
  workTimeTimerId = window.setInterval(() => {
    workTimeNow.value = new Date();
  }, 60_000);
});

onBeforeUnmount(() => {
  if (clockTimerId !== null) {
    clearInterval(clockTimerId);
  }
  if (workTimeTimerId !== null) {
    clearInterval(workTimeTimerId);
  }
});
</script>

<template>
  <main class="dashboard-page">
    <header class="dashboard-header">
      <div class="dashboard-header-main">
        <h1 class="dashboard-title">근무시간 계산기</h1>
        <p class="dashboard-clock">{{ nowLabel }}</p>
      </div>
      <div class="dashboard-user-bar">
        <button type="button" class="dashboard-user-badge" @click="openProfileDialog">
          {{ authStore.user?.userName }}
        </button>
        <button type="button" class="dashboard-logout-btn" aria-label="로그아웃" @click="handleLogout">
          <img :src="logoutIcon" alt="" class="dashboard-logout-icon" />
        </button>
      </div>
    </header>

    <ProfileEditDialog
      v-if="authStore.user"
      :visible="profileDialogVisible"
      :user="authStore.user"
      @close="closeProfileDialog"
      @saved="handleProfileSaved"
    />

    <WeekPreviewSheet v-model:open="weekPreviewOpen" :user-id="userId" />

    <section class="dashboard-body">
        <WeekNavigator
          class="dashboard-nav"
          :week-start="state.weeklyReport.weekStart"
          :week-end="state.weeklyReport.weekEnd"
          :is-current-week="isCurrentWeek"
          :loading="state.loading"
          @prev="shiftWeek(-1)"
          @next="shiftWeek(1)"
          @this-week="goToThisWeek"
        />

        <DashboardMobileTabs v-model="mobileWorkTab" />

        <div
          class="dashboard-work-column"
          role="tabpanel"
          :aria-hidden="mobileWorkTab !== 'main'"
          :class="{ 'dashboard-tab-panel--hidden': mobileWorkTab !== 'main' }"
        >
          <div class="dashboard-column-toolbar">
            <h2 class="dashboard-table-heading">일반 근무</h2>
            <ReportCopyButton @copy="copyWeeklyReport" />
          </div>
          <MainSummaryCard
            :summary="workSummary"
            :is-current-week="isCurrentWeek"
            @open-preview="openWeekPreview"
          />
          <MainTable
            :days="state.weeklyReport.days"
            :today-work-date="highlightTodayDate"
            :today-worked-minutes="todayWorkedMinutes"
            :use-live-today="isCurrentWeek"
            @update-check-in="updateWeeklyCheckIn"
            @update-check-out="updateWeeklyCheckOut"
            @clear-check-in="clearWeeklyCheckIn"
            @clear-check-out="clearWeeklyCheckOut"
            @save-day-settings="saveWeeklyDaySettings"
          />
        </div>

        <div
          class="dashboard-ot-column"
          role="tabpanel"
          :aria-hidden="mobileWorkTab !== 'ot'"
          :class="{ 'dashboard-tab-panel--hidden': mobileWorkTab !== 'ot' }"
        >
          <div class="dashboard-column-toolbar">
            <h2 class="dashboard-table-heading">시간외 근무</h2>
            <ReportCopyButton :disabled="!otReportHasRows" @copy="copyOtReport" />
          </div>
          <OtSummaryCard :summary="workSummary" />
          <OtTableCard
            :days="state.weeklyReport.days"
            :today-work-date="highlightTodayDate"
            :today-extra-minutes="todayExtraMinutes"
            :today-ot-context="todayOtContext"
            :use-live-today="isCurrentWeek"
            @update-ot-start="updateWeeklyOtStart"
            @update-ot-end="updateWeeklyOtEnd"
            @clear-ot-start="clearWeeklyOtStart"
            @clear-ot-end="clearWeeklyOtEnd"
            @save-day-settings="saveWeeklyDaySettings"
          />
        </div>

      <div class="dashboard-reports-hidden" aria-hidden="true">
        <MainReport
          ref="weeklyReportRef"
          hidden
          :weekly-report="state.weeklyReport"
          :today-work-date="todayDateKey"
          :today-worked-minutes="todayWorkedMinutes"
          :use-live-today="isCurrentWeek"
        />
        <OtReportPreview
          ref="otReportRef"
          hidden
          :weekly-report="state.weeklyReport"
          :today-work-date="todayDateKey"
          :today-ot-context="todayOtContext"
          :use-live-today="isCurrentWeek"
        />
      </div>

      <PunchCard
        class="dashboard-punch-card"
        :status="state.todayStatus"
        :loading="state.actionLoading"
        :can-check-in="canCheckIn"
        :can-check-out="canCheckOut"
        :day-type="state.todayWork.dayType"
        :is-ot="state.todayWork.isOt"
        :remark="state.todayWork.remark"
        :display-main-end="todayLiveWork.mainEnd ?? null"
        :display-ot-start="todayLiveWork.otStart ?? null"
        :has-check-in="Boolean(effectiveTodayWork.rawStart)"
        :toast-message="state.toastMessage"
        :action-time-display="actionTimeDisplay"
        :is-action-time-editable="isActionTimeEditable"
        :is-action-time-locked="isActionTimeLocked"
        :error-message="state.errorMessage"
        @check-in="handleCheckIn"
        @check-out="handleCheckOut"
        @apply-settings="applyWorkSettings"
        @update-main-end="updateTodayMainEnd"
        @update-ot-start="updateTodayOtStart"
        @save-settings="persistWorkSettings"
        @apply-picked-time="applyPickedTime"
      />
    </section>
  </main>
</template>
