<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";
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
import ProfileEditDialog from "../components/auth/ProfileEditDialog.vue";
import logoutIcon from "../assets/icons/logout.svg";
import { useDashboard } from "../composables/useDashboard";
import { useAuthStore } from "../stores/auth";
import { useBootStore } from "../stores/boot";
import { bootLog } from "../utils/bootLog";
import { buildOtReport } from "../utils/ot";
import { isWorking, mergeToday, calcResult } from "../utils/timeCalculator";
import { localDateKey } from "../utils/localDate";
import { mainSummary } from "../utils/main";
import { hhmmToDateTime, parseDateTime } from "../utils/time";

const WeekPreviewSheet = defineAsyncComponent(
  () => import("../components/dashboard/WeekPreviewSheet.vue")
);

const authStore = useAuthStore();
const bootStore = useBootStore();
const router = useRouter();
const userId = authStore.user!.userId;

const {
  state,
  isCurrentWeek,
  actTime,
  isActTimeEditable,
  isActTimeLocked,
  applyPickedTime,
  onClockTick,
  canCheckIn,
  canCheckOut,
  handleCheckIn,
  handleCheckOut,
  setWorkSettings,
  setMainEnd,
  setOtStart,
  saveWorkSettings,
  setWeekIn,
  setWeekOut,
  setWeekMainEnd,
  setWeekOtStart,
  setWeekOtEnd,
  clearWeekIn,
  clearWeekOut,
  clearWeekOtStart,
  clearWeekOtEnd,
  saveWeekSettings,
  shiftWeek,
  goToThisWeek,
  loadDashboard
} = useDashboard(userId);

const isProfileOpen = ref(false);
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
  try {
    await authStore.logout();
  } finally {
    bootStore.resetShellReady();
    await router.replace("/login");
  }
}

function openProfile() {
  isProfileOpen.value = true;
}

function closeProfile() {
  isProfileOpen.value = false;
}

function openWeekPreview() {
  weekPreviewOpen.value = true;
}

async function handleProfileSaved() {
  await loadDashboard();
}

const now = ref(new Date());
let clockTimerId: number | null = null;

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

const mergedToday = computed(() =>
  mergeToday(
    state.value.todayWork,
    state.value.weeklyReport.days,
    todayDateKey.value
  )
);

const prvTime = computed(() => {
  const work = mergedToday.value;
  if (isWorking(work) && isCurrentWeek.value) {
    return parseDateTime(hhmmToDateTime(todayDateKey.value, actTime.value)) ?? now.value;
  }
  return now.value;
});

const todayLiveWork = computed(() => {
  const work = mergedToday.value;
  if (isWorking(work) && isCurrentWeek.value) {
    return calcResult(work, prvTime.value);
  }
  return calcResult(work);
});

const todayMainMin = computed(() => {
  if (isWorking(mergedToday.value) && isCurrentWeek.value) {
    return todayLiveWork.value.main;
  }
  return mergedToday.value.main;
});

const todayExtra = computed(() => ({
  extra1: todayLiveWork.value.extra1,
  extra2: todayLiveWork.value.extra2
}));

const otCtx = computed(() => {
  const work = mergedToday.value;
  const live = todayLiveWork.value;
  const useLive = isWorking(work) && isCurrentWeek.value;

  return {
    extra1: live.extra1,
    extra2: live.extra2,
    otStart: useLive ? live.otStart : work.otStart ?? null,
    otEnd: useLive ? live.otEnd : work.otEnd ?? null,
    remark: work.remark
  };
});

const workSummary = computed(() =>
  mainSummary({
    weeklyReport: state.value.weeklyReport,
    todayWork: mergedToday.value,
    todayDateKey: todayDateKey.value,
    todayMainMin: todayMainMin.value,
    todayExtra: todayExtra.value,
    isLiveToday: isCurrentWeek.value
  })
);

const todayHighlight = computed(() => (isCurrentWeek.value ? todayDateKey.value : ""));

const hasOtRows = computed(
  () =>
    buildOtReport(state.value.weeklyReport, {
      todayWorkDate: todayDateKey.value,
      otCtx: otCtx.value,
      isLiveToday: isCurrentWeek.value
    }).rows.length > 0
);

async function copyWeekReport() {
  await weeklyReportRef.value?.copy();
}

async function copyOtReport() {
  await otReportRef.value?.copy();
}

onMounted(() => {
  bootLog("dashboard.view.mounted", { userId });
  clockTimerId = window.setInterval(() => {
    now.value = new Date();
    onClockTick(now.value);
  }, 1000);
});

onBeforeUnmount(() => {
  if (clockTimerId !== null) {
    clearInterval(clockTimerId);
  }
});
</script>

<template>
  <!-- shellReady 전: emptyWeekReport 껍데기(빈 이름/1월 1주)를 DOM에 올리지 않음 -->
  <main v-if="bootStore.shellReady" class="dashboard-page">
    <header class="dashboard-header">
      <div class="dashboard-header-main">
        <h1 class="dashboard-title">근무시간 계산기</h1>
        <p class="dashboard-clock">{{ nowLabel }}</p>
      </div>
      <div class="dashboard-user-bar">
        <button type="button" class="dashboard-user-badge" @click="openProfile">
          {{ authStore.user?.name }}
        </button>
        <button type="button" class="dashboard-logout-btn" aria-label="로그아웃" @click="handleLogout">
          <img :src="logoutIcon" alt="" class="dashboard-logout-icon" />
        </button>
      </div>
    </header>

    <ProfileEditDialog
      v-if="authStore.user"
      :visible="isProfileOpen"
      :user="authStore.user"
      @close="closeProfile"
      @saved="handleProfileSaved"
    />

    <WeekPreviewSheet
      v-if="weekPreviewOpen"
      v-model:open="weekPreviewOpen"
      :user-id="userId"
      :as-of="now"
    />

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
            <ReportCopyButton @copy="copyWeekReport" />
          </div>
          <MainSummaryCard
            :summary="workSummary"
            :is-current-week="isCurrentWeek"
            @open-preview="openWeekPreview"
          />
          <MainTable
            :days="state.weeklyReport.days"
            :today-work-date="todayHighlight"
            :today-main-min="todayMainMin"
            :today-main-end="todayLiveWork.mainEnd ?? null"
            :is-live-today="isCurrentWeek"
            @update-check-in="setWeekIn"
            @update-check-out="setWeekOut"
            @update-main-end="setWeekMainEnd"
            @clear-check-in="clearWeekIn"
            @clear-check-out="clearWeekOut"
            @save-day-settings="saveWeekSettings"
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
            <ReportCopyButton :disabled="!hasOtRows" @copy="copyOtReport" />
          </div>
          <OtSummaryCard :summary="workSummary" />
          <OtTableCard
            :days="state.weeklyReport.days"
            :today-work-date="todayHighlight"
            :today-extra="todayExtra"
            :ot-ctx="otCtx"
            :is-live-today="isCurrentWeek"
            @update-ot-start="setWeekOtStart"
            @update-ot-end="setWeekOtEnd"
            @clear-ot-start="clearWeekOtStart"
            @clear-ot-end="clearWeekOtEnd"
            @save-day-settings="saveWeekSettings"
          />
        </div>

      <div class="dashboard-reports-hidden" aria-hidden="true">
        <MainReport
          ref="weeklyReportRef"
          hidden
          :weekly-report="state.weeklyReport"
          :today-work-date="todayDateKey"
          :today-work="mergedToday"
          :today-main-min="todayMainMin"
          :is-live-today="isCurrentWeek"
        />
        <OtReportPreview
          ref="otReportRef"
          hidden
          :weekly-report="state.weeklyReport"
          :today-work-date="todayDateKey"
          :ot-ctx="otCtx"
          :is-live-today="isCurrentWeek"
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
        :has-check-in="Boolean(mergedToday.rawStart)"
        :toast-message="state.toastMessage"
        :act-time="actTime"
        :is-act-time-editable="isActTimeEditable"
        :is-act-time-locked="isActTimeLocked"
        :error-message="state.errorMessage"
        @check-in="handleCheckIn"
        @check-out="handleCheckOut"
        @apply-settings="setWorkSettings"
        @update-main-end="setMainEnd"
        @update-ot-start="setOtStart"
        @save-settings="saveWorkSettings"
        @apply-picked-time="applyPickedTime"
      />
    </section>
  </main>
</template>
