import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  checkIn,
  checkOut,
  createEmptyWork,
  fetchTodayWork,
  fetchWeeklyReport,
  fetchWork,
  loadCachedTodayWork,
  saveWorkSettings,
  type WorkMutationOptions
} from "../api/dashboard";
import type { DashboardState, DayType, TodayStatus, WeeklyDayRow, WeeklyReport, Work } from "../types/dashboard";
import {
  isMainEndBeforeCore,
  shouldCancelOtOnCheckout,
  syncOtAnchorsFromMainEnd,
  syncOtAnchorsFromOtStart
} from "../utils/ot";
import { applyCalculatedFields, applyOtRecalc } from "../utils/timeCalculator";
import { localDateKey } from "../utils/localDate";
import {
  computeAvgRequiredPerDay,
  countRemainingWorkDaysExcludingToday
} from "../utils/main";
import { copyTextToClipboard } from "../utils/reportClipboard";
import { currentDateKey, isSameWeek, shiftDateKey } from "../utils/weekNav";

function createInitialTodayWork(userId: number): Work {
  const cached = loadCachedTodayWork(userId);
  if (cached) {
    return cached;
  }
  return createEmptyWork(userId, localDateKey());
}

const DAY_OFF_TYPES: DayType[] = ["MON", "ANN", "HOL"];

let dashboardLoadGeneration = 0;

function createEmptyWeeklyReport(): WeeklyReport {
  return {
    weekStart: "",
    weekEnd: "",
    summary: {
      workedMinutes: 0,
      targetMinutes: 40 * 60,
      remainingMinutes: 40 * 60,
      avgRequiredPerDayMinutes: 8 * 60,
      remainingWorkDays: 5
    },
    days: [],
    header: {
      department: "",
      team: "",
      userName: "",
      reportMonth: 1,
      reportWeekNumber: 1
    }
  };
}

export interface DaySettingsPayload {
  workDate: string;
  dayType: DayType;
  isOt: boolean;
  remark: string | null;
}

export function useDashboard(userId: number) {
  const state = ref<DashboardState>({
    todayStatus: "BEFORE_CHECK_IN",
    todayWork: createInitialTodayWork(userId),
    weeklyReport: createEmptyWeeklyReport(),
    loading: false,
    actionLoading: false,
    errorMessage: null,
    toastMessage: null,
    lastSyncedAt: null
  });

  let toastTimerId: number | null = null;

  const canCheckIn = computed(
    () =>
      state.value.todayStatus === "BEFORE_CHECK_IN" &&
      !state.value.actionLoading &&
      !DAY_OFF_TYPES.includes(state.value.todayWork.dayType)
  );

  const canCheckOut = computed(
    () =>
      state.value.todayStatus === "WORKING" &&
      !state.value.actionLoading &&
      !DAY_OFF_TYPES.includes(state.value.todayWork.dayType)
  );

  const referenceDate = ref(currentDateKey());

  const isCurrentWeek = computed(() =>
    isSameWeek(referenceDate.value, currentDateKey())
  );

  const actionTimeDisplay = ref("00:00");
  const isActionTimeManual = ref(false);
  const isActionTimeLocked = ref(false);
  let timeIntervalId: number | null = null;

  function applyWeeklyReport(weekly: WeeklyReport) {
    const merged = isCurrentWeek.value
      ? mergeWeeklyWithToday(weekly, state.value.todayWork)
      : weekly;
    state.value.weeklyReport = merged;
  }

  async function loadWeeklyReport() {
    const weeklyReport = await fetchWeeklyReport(userId, referenceDate.value);
    applyWeeklyReport(weeklyReport);
  }

  function formatNowHm(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function applyActionTimeTick() {
    if (isActionTimeLocked.value) {
      return;
    }
    if (isActionTimeManual.value) {
      return;
    }
    const s = state.value.todayStatus;
    if (s !== "BEFORE_CHECK_IN" && s !== "WORKING" && s !== "DONE") {
      return;
    }
    actionTimeDisplay.value = formatNowHm();
  }

  const isActionTimeEditable = computed(
    () =>
      (state.value.todayStatus === "BEFORE_CHECK_IN" ||
        state.value.todayStatus === "WORKING" ||
        state.value.todayStatus === "DONE") &&
      !DAY_OFF_TYPES.includes(state.value.todayWork.dayType)
  );

  function applyPickedTime(hhmm: string) {
    isActionTimeManual.value = true;
    actionTimeDisplay.value = hhmm;
    if (state.value.todayWork.isOt && !state.value.todayWork.rawEnd) {
      clearOtAnchorsLocal(state.value.todayWork);
    }
  }

  function resolveApiTime(): string {
    return actionTimeDisplay.value.slice(0, 5);
  }

  async function loadDashboard() {
    const generation = ++dashboardLoadGeneration;
    state.value.loading = true;
    state.value.errorMessage = null;
    try {
      const [todayWork, weeklyReport] = await Promise.all([
        fetchTodayWork(userId),
        fetchWeeklyReport(userId, referenceDate.value)
      ]);

      if (generation !== dashboardLoadGeneration) {
        return;
      }

      state.value.todayWork = todayWork;
      applyWeeklyReport(weeklyReport);
      state.value.todayStatus = resolveStatus(todayWork);
      isActionTimeLocked.value = false;
      isActionTimeManual.value = false;
      actionTimeDisplay.value = formatNowHm();
      applyActionTimeTick();
      state.value.lastSyncedAt = new Date().toISOString();
    } catch (error) {
      if (generation === dashboardLoadGeneration) {
        state.value.errorMessage = resolveMessage(error);
      }
    } finally {
      if (generation === dashboardLoadGeneration) {
        state.value.loading = false;
      }
    }
  }

  async function refreshWeeklyWithToday(updated: Work) {
    const weeklyReport = await fetchWeeklyReport(userId, referenceDate.value);
    if (updated.workDate === localDateKey()) {
      state.value.todayWork = updated;
      state.value.todayStatus = resolveStatus(updated);
      isActionTimeManual.value = false;
      isActionTimeLocked.value = false;
      applyActionTimeTick();
    }
    applyWeeklyReport(weeklyReport);
  }

  async function handleCheckIn() {
    if (!canCheckIn.value) {
      return;
    }
    void copyTextToClipboard(`출근보고 ${resolveApiTime()}`);
    await runAction(async () => {
      const today = localDateKey();
      const rawStart = toDateTimeValue(today, resolveApiTime());
      let work: Work = {
        ...state.value.todayWork,
        rawStart
      };
      if (work.isOt && work.rawEnd) {
        work = applyOtRecalc(work, "raw_start");
      }
      const updated = await checkIn(userId, buildMutationFromWork(work, { rawStart }));
      if (isCurrentWeek.value) {
        await refreshWeeklyWithToday(updated);
      } else {
        state.value.todayWork = updated;
        state.value.todayStatus = resolveStatus(updated);
      }
      isActionTimeManual.value = false;
      isActionTimeLocked.value = false;
      applyActionTimeTick();
    });
  }

  function showToast(message: string) {
    state.value.toastMessage = message;
    if (toastTimerId !== null) {
      window.clearTimeout(toastTimerId);
    }
    toastTimerId = window.setTimeout(() => {
      state.value.toastMessage = null;
      toastTimerId = null;
    }, 3000);
  }

  async function handleCheckOut() {
    if (!canCheckOut.value) {
      return;
    }
    void copyTextToClipboard(`퇴근보고 ${resolveApiTime()}`);
    await runAction(async () => {
      const today = localDateKey();
      const rawEnd = toDateTimeValue(today, resolveApiTime());
      const { work, cancelled: otCancelled } = processOtOnCheckout(
        { ...state.value.todayWork, rawEnd },
        rawEnd!
      );

      const updated = await checkOut(userId, buildMutationFromWork(work, { rawEnd }));
      if (otCancelled) {
        showToast("코어타임 종료 이전이라 야근이 취소되었습니다.");
      }
      if (isCurrentWeek.value) {
        await refreshWeeklyWithToday(updated);
      } else {
        state.value.todayWork = updated;
        state.value.todayStatus = resolveStatus(updated);
      }
      isActionTimeManual.value = false;
      isActionTimeLocked.value = false;
      applyActionTimeTick();
    });
  }

  function setDayType(dayType: DayType) {
    state.value.todayWork.dayType = dayType;
    if (dayType !== "HOL" && !state.value.todayWork.isOt) {
      state.value.todayWork.remark = null;
    }
    if (DAY_OFF_TYPES.includes(dayType)) {
      state.value.todayWork.isOt = false;
      clearOtAnchorsLocal(state.value.todayWork);
    }
  }

  function setRemark(remark: string) {
    state.value.todayWork.remark = remark.trim() || null;
  }

  function toggleOt() {
    const next = !state.value.todayWork.isOt;
    const work: Work = { ...state.value.todayWork, isOt: next };
    if (!next) {
      if (work.dayType !== "HOL") {
        work.remark = null;
      }
      clearOtAnchorsLocal(work);
    }
    state.value.todayWork = work;
  }

  function updateTodayMainEnd(hhmm: string) {
    const work = state.value.todayWork;
    const mainEnd = toDateTimeValue(work.workDate, hhmm);
    if (!mainEnd) {
      return;
    }
    if (!work.rawEnd) {
      const anchors = syncOtAnchorsFromMainEnd(work.workDate, mainEnd);
      state.value.todayWork = { ...work, ...anchors };
      return;
    }
    state.value.todayWork = applyOtRecalc(work, "main_end", { mainEnd });
  }

  function updateTodayOtStart(hhmm: string) {
    const work = state.value.todayWork;
    const otStart = toDateTimeValue(work.workDate, hhmm);
    if (!otStart) {
      return;
    }
    if (!work.rawEnd) {
      const anchors = syncOtAnchorsFromOtStart(work.workDate, otStart);
      state.value.todayWork = { ...work, ...anchors };
      return;
    }
    state.value.todayWork = applyOtRecalc(work, "ot_start", { otStart });
  }

  function applyWorkSettings(payload: { dayType: DayType; isOt: boolean; remark: string | null }) {
    const finalIsOt = DAY_OFF_TYPES.includes(payload.dayType) ? false : payload.isOt;
    const finalRemark =
      payload.dayType === "HOL" || finalIsOt ? payload.remark?.trim() || null : null;

    const work: Work = {
      ...state.value.todayWork,
      dayType: payload.dayType,
      isOt: finalIsOt,
      remark: finalRemark
    };

    if (!finalIsOt) {
      clearOtAnchorsLocal(work);
    }

    state.value.todayWork = work;
  }

  async function persistWorkSettings() {
    await runAction(async () => {
      const work = state.value.todayWork;
      if (!work.rawEnd) {
        clearOtAnchorsLocal(work);
      }
      const updated = await saveWorkSettings(userId, buildSettingsOnlyMutation(work));
      await syncAfterWeeklyEdit(normalizeWorkAfterSettingsSave(updated));
    });
  }

  async function updateWeeklyCheckIn(workDate: string, hhmm: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const rawStart = toDateTimeValue(workDate, hhmm);
      let work: Work = { ...existing, rawStart };
      if (work.isOt && work.rawEnd) {
        work = applyOtRecalc(work, "raw_start");
      }
      const updated = await checkIn(userId, buildMutationFromWork(work, { rawStart, workDate }));
      await syncAfterWeeklyEdit(updated);
    });
  }

  async function updateWeeklyCheckOut(workDate: string, hhmm: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const rawEnd = toDateTimeValue(workDate, hhmm);
      const { work } = processOtOnCheckout({ ...existing, rawEnd }, rawEnd!);
      const updated = await checkOut(userId, buildMutationFromWork(work, { rawEnd, workDate }));
      await syncAfterWeeklyEdit(updated);
    });
  }

  async function updateWeeklyOtStart(workDate: string, hhmm: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const otStart = toDateTimeValue(workDate, hhmm);
      const work = applyOtRecalc({ ...existing, otStart }, "ot_start", { otStart });
      const updated = await saveWorkSettings(userId, buildMutationFromWork(work, { workDate }));
      await syncAfterWeeklyEdit(updated);
    });
  }

  async function updateWeeklyOtEnd(workDate: string, hhmm: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const otEnd = toDateTimeValue(workDate, hhmm);
      const work = applyOtRecalc({ ...existing, otEnd }, "ot_end", { otEnd });
      const updated = await saveWorkSettings(userId, buildMutationFromWork(work, { workDate }));
      await syncAfterWeeklyEdit(updated);
    });
  }

  async function clearWeeklyCheckIn(workDate: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const updated = await saveWorkSettings(userId, {
        workDate,
        dayType: existing.dayType,
        isOt: existing.isOt,
        remark: resolveRemarkForApi(existing),
        clearRawStart: true,
        clearMainEnd: true,
        clearOtStart: true,
        clearOtEnd: true
      });
      await syncAfterWeeklyEdit(updated);
    });
  }

  async function clearWeeklyCheckOut(workDate: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const updated = await saveWorkSettings(userId, {
        workDate,
        dayType: existing.dayType,
        isOt: existing.isOt,
        remark: resolveRemarkForApi(existing),
        clearRawEnd: true,
        clearMainEnd: true,
        clearOtStart: true,
        clearOtEnd: true
      });
      await syncAfterWeeklyEdit(updated);
    });
  }

  async function clearWeeklyOtStart(workDate: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const updated = await saveWorkSettings(
        userId,
        buildSettingsOnlyMutation(existing, {
          workDate,
          clearMainEnd: true,
          clearOtStart: true
        })
      );
      await syncAfterWeeklyEdit(normalizeWorkAfterSettingsSave(updated));
    });
  }

  async function clearWeeklyOtEnd(workDate: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const updated = await saveWorkSettings(
        userId,
        buildSettingsOnlyMutation(existing, {
          workDate,
          clearOtEnd: true
        })
      );
      await syncAfterWeeklyEdit(updated.rawEnd ? updated : normalizeWorkAfterSettingsSave(updated));
    });
  }

  async function saveWeeklyDaySettings(payload: DaySettingsPayload) {
    await runAction(async () => {
      const existing = await fetchWork(userId, payload.workDate);
      const finalIsOt = DAY_OFF_TYPES.includes(payload.dayType) ? false : payload.isOt;
      const finalRemark =
        payload.dayType === "HOL" || finalIsOt ? payload.remark?.trim() || null : null;

      let work: Work = {
        ...existing,
        dayType: payload.dayType,
        isOt: finalIsOt,
        remark: finalRemark
      };

      if (!finalIsOt) {
        clearOtAnchorsLocal(work);
      }

      const settingsOverride: WorkMutationOptions = {
        workDate: payload.workDate,
        dayType: payload.dayType,
        isOt: finalIsOt,
        remark: finalRemark
      };

      let updated: Work;
      if (!finalIsOt) {
        updated = await saveWorkSettings(
          userId,
          buildSettingsOnlyMutation(work, settingsOverride)
        );
      } else if (!existing.isOt && finalIsOt && work.rawStart && work.rawEnd) {
        work = applyOtRecalc(work, "auto");
        updated = await saveWorkSettings(
          userId,
          buildMutationFromWork(work, settingsOverride)
        );
      } else {
        updated = await saveWorkSettings(
          userId,
          buildSettingsOnlyMutation(work, settingsOverride)
        );
      }
      await syncAfterWeeklyEdit(normalizeWorkAfterSettingsSave(updated));
    });
  }

  async function syncAfterWeeklyEdit(updated: Work) {
    await refreshWeeklyWithToday(updated);
  }

  async function shiftWeek(delta: number) {
    if (state.value.loading || state.value.actionLoading) {
      return;
    }
    state.value.loading = true;
    state.value.errorMessage = null;
    try {
      referenceDate.value = shiftDateKey(referenceDate.value, delta * 7);
      await loadWeeklyReport();
      state.value.lastSyncedAt = new Date().toISOString();
    } catch (error) {
      state.value.errorMessage = resolveMessage(error);
    } finally {
      state.value.loading = false;
    }
  }

  async function goToThisWeek() {
    if (isCurrentWeek.value || state.value.loading || state.value.actionLoading) {
      return;
    }
    referenceDate.value = currentDateKey();
    state.value.loading = true;
    state.value.errorMessage = null;
    try {
      await loadWeeklyReport();
      state.value.lastSyncedAt = new Date().toISOString();
    } catch (error) {
      state.value.errorMessage = resolveMessage(error);
    } finally {
      state.value.loading = false;
    }
  }

  async function retry() {
    await loadDashboard();
  }

  async function runAction(callback: () => Promise<void>) {
    dashboardLoadGeneration += 1;
    state.value.actionLoading = true;
    state.value.errorMessage = null;
    try {
      await callback();
      state.value.lastSyncedAt = new Date().toISOString();
    } catch (error) {
      state.value.errorMessage = resolveMessage(error);
    } finally {
      state.value.actionLoading = false;
    }
  }

  onMounted(() => {
    void loadDashboard();
    timeIntervalId = window.setInterval(applyActionTimeTick, 1000);
  });

  onUnmounted(() => {
    if (timeIntervalId !== null) {
      clearInterval(timeIntervalId);
    }
    if (toastTimerId !== null) {
      window.clearTimeout(toastTimerId);
    }
  });

  return {
    state,
    referenceDate,
    isCurrentWeek,
    actionTimeDisplay,
    isActionTimeEditable,
    isActionTimeLocked,
    applyPickedTime,
    canCheckIn,
    canCheckOut,
    loadDashboard,
    shiftWeek,
    goToThisWeek,
    retry,
    handleCheckIn,
    handleCheckOut,
    setDayType,
    setRemark,
    toggleOt,
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
    saveWeeklyDaySettings
  };
}

function processOtOnCheckout(
  work: Work,
  rawEnd: string
): { work: Work; cancelled: boolean } {
  if (!work.isOt) {
    return { work: { ...work, rawEnd }, cancelled: false };
  }

  const checkoutAt = new Date(rawEnd.replace(" ", "T"));
  if (shouldCancelOtOnCheckout(work.workDate, checkoutAt)) {
    const next = { ...work, rawEnd, isOt: false };
    clearOtAnchorsLocal(next);
    return { work: next, cancelled: true };
  }

  let next = applyOtRecalc({ ...work, rawEnd }, "raw_end");
  const calc = applyCalculatedFields({ ...next, rawEnd });
  const mainEndDt = calc.mainEnd ? new Date(calc.mainEnd.replace(" ", "T")) : null;
  const hasExtra = calc.extra1 + calc.extra2 > 0;
  const eligible =
    mainEndDt != null &&
    !isMainEndBeforeCore(mainEndDt, work.workDate) &&
    calc.otStart != null;

  if (!eligible || !hasExtra) {
    next = { ...next, rawEnd, isOt: false };
    clearOtAnchorsLocal(next);
    return { work: next, cancelled: true };
  }

  return { work: next, cancelled: false };
}

/** 근무 설정 저장: isOt·remark·dayType만 전송. 퇴근 전에는 앵커 필드도 DB에서 비움. */
function buildSettingsOnlyMutation(work: Work, override: WorkMutationOptions = {}): WorkMutationOptions {
  const { mainEnd: _mainEnd, otStart: _otStart, otEnd: _otEnd, ...safeOverride } = override;
  const hasCheckout = Boolean(safeOverride.rawEnd ?? work.rawEnd);
  return {
    workDate: work.workDate,
    dayType: safeOverride.dayType ?? work.dayType,
    isOt: safeOverride.isOt ?? work.isOt,
    remark:
      safeOverride.remark !== undefined ? safeOverride.remark : resolveRemarkForApi(work),
    ...(hasCheckout
      ? {}
      : {
          clearMainEnd: true,
          clearOtStart: true,
          clearOtEnd: true
        }),
    ...safeOverride
  };
}

function normalizeWorkAfterSettingsSave(work: Work): Work {
  if (work.rawEnd) {
    return work;
  }
  const stripped = { ...work, mainEnd: null, otStart: null, otEnd: null };
  return applyCalculatedFields(stripped);
}

function buildMutationFromWork(work: Work, override: WorkMutationOptions = {}): WorkMutationOptions {
  const hasCheckout = Boolean(override.rawEnd ?? work.rawEnd);

  if (!hasCheckout) {
    return buildSettingsOnlyMutation(work, override);
  }

  const calc = applyCalculatedFields(work);
  return {
    workDate: work.workDate,
    dayType: work.dayType,
    isOt: work.isOt,
    remark: resolveRemarkForApi(work),
    mainEnd: calc.mainEnd,
    otStart: calc.otStart,
    otEnd: calc.otEnd,
    clearMainEnd: !work.isOt,
    clearOtStart: !work.isOt || !calc.otStart,
    clearOtEnd: !work.isOt,
    ...override
  };
}

function clearOtAnchorsLocal(work: Work): void {
  work.mainEnd = null;
  work.otStart = null;
  work.otEnd = null;
}

function resolveRemarkForApi(work: Work): string | null {
  if (work.dayType === "HOL" || work.isOt) {
    return work.remark?.trim() || null;
  }
  return null;
}

function resolveStatus(work: Work): TodayStatus {
  if (work.rawEnd) {
    return "DONE";
  }
  if (work.rawStart) {
    return "WORKING";
  }
  return "BEFORE_CHECK_IN";
}

function mergeWeeklyWithToday(weekly: WeeklyReport, today: Work, asOf = new Date()): WeeklyReport {
  const todayDate = localDateKey(asOf);
  const normalizedToday = { ...today, workDate: todayDate };
  const calculatedToday = applyCalculatedFields(normalizedToday, asOf);
  const days = weekly.days.map((day) => mergeDayWithToday(day, calculatedToday, todayDate));
  const workedMinutes = days.reduce((sum, day) => sum + day.main, 0);
  const targetMinutes = weekly.summary.targetMinutes;
  const remainingMinutes = Math.max(targetMinutes - workedMinutes, 0);
  const remainingWorkDays = countRemainingWorkDaysExcludingToday(todayDate, weekly.weekEnd);
  const avgRequiredPerDayMinutes = computeAvgRequiredPerDay(
    remainingMinutes,
    remainingWorkDays
  );

  return {
    ...weekly,
    summary: {
      workedMinutes,
      targetMinutes,
      remainingMinutes,
      avgRequiredPerDayMinutes,
      remainingWorkDays
    },
    days
  };
}

function mergeDayWithToday(day: WeeklyDayRow, today: Work, todayDate: string): WeeklyDayRow {
  if (day.workDate !== todayDate) {
    return day;
  }

  const isDayOff = DAY_OFF_TYPES.includes(today.dayType);

  return {
    ...day,
    rawStart: isDayOff ? null : today.rawStart,
    rawEnd: isDayOff ? null : today.rawEnd,
    main: today.main,
    extra1: today.extra1,
    extra2: today.extra2,
    isOt: today.isOt,
    mainEnd: today.mainEnd ?? null,
    otStart: today.otStart ?? null,
    otEnd: today.otEnd ?? null,
    dayType: today.dayType,
    remark: today.remark
  };
}

function resolveMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    const message = response?.data?.message?.trim();
    if (message) {
      return message;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "일시적인 오류가 발생했습니다. 잠시만 기다려 주세요.";
}

function toDateTimeValue(workDate: string, timeValue: string): string | null {
  if (!timeValue) {
    return null;
  }
  return `${workDate} ${timeValue}`;
}
