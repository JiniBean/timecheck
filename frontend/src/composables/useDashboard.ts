import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  checkIn,
  checkOut,
  emptyWork,
  fetchWeek,
  fetchWork,
  loadTodayCache,
  patchWork,
  type WorkPatch
} from "../api/dashboard";
import type { DashboardState, DayType, TodayStatus, WeekDay, WeekReport, Work } from "../types/dashboard";
import {
  isBeforeCore,
  shouldCancelOt,
  syncFromMainEnd,
  syncFromOtStart
} from "../utils/ot";
import { withCalc, withOtRecalc } from "../utils/timeCalculator";
import { localDateKey } from "../utils/localDate";
import {
  avgPerDay,
  remainDays
} from "../utils/main";
import { useBootStore } from "../stores/boot";
import { apiErrMsg } from "../utils/apiError";
import { bootError, bootLog } from "../utils/bootLog";
import { copyText } from "../utils/reportClipboard";
import { currentDateKey, isSameWeek, shiftDateKey } from "../utils/weekNav";
import { isDayOff } from "../utils/dayType";
import { compareHm, formatNowHm, hhmmToDateTime } from "../utils/time";
import { WorkPolicy } from "../utils/workPolicy";

function initTodayWork(userId: number): Work {
  const cached = loadTodayCache(userId);
  if (cached) {
    return cached;
  }
  return emptyWork(userId, localDateKey());
}

let loadGen = 0;

function emptyWeekReport(): WeekReport {
  return {
    weekStart: "",
    weekEnd: "",
    summary: {
      mainMin: 0,
      baseMin: 40 * 60,
      remMin: 40 * 60,
      avgPerDayMin: 8 * 60,
      daysAfter: 5
    },
    days: [],
    header: {
      department: "",
      team: "",
      name: "",
      position: null,
      reportMonth: 1,
      weekNum: 1
    }
  };
}

export interface DaySettings {
  workDate: string;
  dayType: DayType;
  isOt: boolean;
  remark: string | null;
}

export function useDashboard(userId: number) {
  const bootStore = useBootStore();
  bootStore.resetShellReady();

  const state = ref<DashboardState>({
    todayStatus: "BEFORE_CHECK_IN",
    todayWork: initTodayWork(userId),
    weeklyReport: emptyWeekReport(),
    loading: false,
    actionLoading: false,
    errorMessage: null,
    toastMessage: null,
    lastSyncedAt: null
  });

  let toastTimerId: number | null = null;
  let refreshingToday = false;

  async function ensureTodayWork(): Promise<void> {
    const today = localDateKey();
    if (state.value.todayWork.workDate === today || refreshingToday) {
      return;
    }
    refreshingToday = true;
    try {
      const todayWork = await fetchWork(userId, today);
      state.value.todayWork = todayWork;
      state.value.todayStatus = resolveStatus(todayWork);
      isActTimeManual.value = false;
      isActTimeLocked.value = false;
      syncActTime(new Date());
      if (isCurrentWeek.value) {
        await loadWeekReport();
      }
    } catch {
      // 자정 rollover 갱신 실패 시 기존 todayWork 유지
    } finally {
      refreshingToday = false;
    }
  }

  function onClockTick(date: Date) {
    void ensureTodayWork();
    syncActTime(date);
  }

  const canCheckIn = computed(
    () =>
      state.value.todayStatus === "BEFORE_CHECK_IN" &&
      !state.value.actionLoading &&
      !isDayOff(state.value.todayWork.dayType)
  );

  const canCheckOut = computed(
    () =>
      state.value.todayStatus === "WORKING" &&
      !state.value.actionLoading &&
      !isDayOff(state.value.todayWork.dayType) &&
      canCheckoutHalfDay(state.value.todayWork.dayType, resolveApiTime())
  );

  const referenceDate = ref(currentDateKey());

  const isCurrentWeek = computed(() =>
    isSameWeek(referenceDate.value, currentDateKey())
  );

  const actTime = ref("00:00");
  const isActTimeManual = ref(false);
  const isActTimeLocked = ref(false);

  function syncActTime(date: Date) {
    if (isActTimeLocked.value) {
      return;
    }
    if (isActTimeManual.value) {
      return;
    }
    const s = state.value.todayStatus;
    if (s !== "BEFORE_CHECK_IN" && s !== "WORKING" && s !== "DONE") {
      return;
    }
    actTime.value = formatNowHm(date);
  }

  const isActTimeEditable = computed(
    () =>
      (state.value.todayStatus === "BEFORE_CHECK_IN" ||
        state.value.todayStatus === "WORKING" ||
        state.value.todayStatus === "DONE") &&
      !isDayOff(state.value.todayWork.dayType)
  );

  function setWeekReport(weekly: WeekReport) {
    const merged = isCurrentWeek.value
      ? mergeWeekToday(weekly, state.value.todayWork)
      : weekly;
    state.value.weeklyReport = merged;
  }

  async function loadWeekReport() {
    const weeklyReport = await fetchWeek(userId, referenceDate.value);
    setWeekReport(weeklyReport);
  }

  function applyPickedTime(hhmm: string) {
    isActTimeManual.value = true;
    actTime.value = hhmm;
    if (state.value.todayWork.isOt && !state.value.todayWork.rawEnd) {
      Object.assign(state.value.todayWork, clearAnchors(state.value.todayWork));
    }
  }

  function resolveApiTime(): string {
    return actTime.value.slice(0, 5);
  }

  function canCheckoutHalfDay(dayType: DayType, hhmm: string): boolean {
    if (dayType !== "PM") {
      return true;
    }
    return compareHm(hhmm, WorkPolicy.HALF_DAY_HHMM) >= 0;
  }

  async function loadDashboard() {
    const generation = ++loadGen;
    state.value.loading = true;
    state.value.errorMessage = null;
    bootLog("dashboard.load.start", { userId, referenceDate: referenceDate.value });
    try {
      const [todayWork, weeklyReport] = await Promise.all([
        fetchWork(userId, localDateKey()),
        fetchWeek(userId, referenceDate.value)
      ]);

      if (generation !== loadGen) {
        bootLog("dashboard.load.stale", { generation, loadGen });
        return;
      }

      state.value.todayWork = todayWork;
      setWeekReport(weeklyReport);
      state.value.todayStatus = resolveStatus(todayWork);
      isActTimeLocked.value = false;
      isActTimeManual.value = false;
      syncActTime(new Date());
      state.value.lastSyncedAt = new Date().toISOString();
      bootLog("dashboard.load.done", {
        weekStart: weeklyReport.weekStart,
        dayCount: weeklyReport.days.length
      });
    } catch (error) {
      bootError("dashboard.load.error", error);
      if (generation === loadGen) {
        state.value.errorMessage = apiErrMsg(error);
      }
    } finally {
      if (generation === loadGen) {
        state.value.loading = false;
        bootStore.markShellReady();
        bootLog("dashboard.load.finally", { loading: false, shellReady: true });
      }
    }
  }

  async function refreshWeek(updated: Work) {
    const weeklyReport = await fetchWeek(userId, referenceDate.value);
    if (updated.workDate === localDateKey()) {
      state.value.todayWork = updated;
      state.value.todayStatus = resolveStatus(updated);
      isActTimeManual.value = false;
      isActTimeLocked.value = false;
      syncActTime(new Date());
    }
    setWeekReport(weeklyReport);
  }

  async function handleCheckIn() {
    if (!canCheckIn.value) {
      return;
    }
    void copyText(`출근보고 ${resolveApiTime()}`);
    await runAction(async () => {
      const today = localDateKey();
      const rawStart = hhmmToDateTime(today, resolveApiTime());
      let work: Work = {
        ...state.value.todayWork,
        rawStart
      };
      if (work.isOt && work.rawEnd) {
        work = withOtRecalc(work, "raw_start");
      }
      const updated = await checkIn(userId, toWorkPatch(work, { rawStart }));
      if (isCurrentWeek.value) {
        await refreshWeek(updated);
      } else {
        state.value.todayWork = updated;
        state.value.todayStatus = resolveStatus(updated);
      }
      isActTimeManual.value = false;
      isActTimeLocked.value = false;
      syncActTime(new Date());
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
      if (
        state.value.todayStatus === "WORKING" &&
        state.value.todayWork.dayType === "PM" &&
        !state.value.actionLoading
      ) {
        state.value.errorMessage = `오후반차는 ${WorkPolicy.HALF_DAY_HHMM} 이후에만 퇴근할 수 있습니다.`;
      }
      return;
    }
    void copyText(`퇴근보고 ${resolveApiTime()}`);
    await runAction(async () => {
      const today = localDateKey();
      const rawEnd = hhmmToDateTime(today, resolveApiTime());
      const { work, cancelled: otCancelled } = otOnCheckout(
        { ...state.value.todayWork, rawEnd },
        rawEnd!
      );

      const updated = await checkOut(userId, toWorkPatch(work, { rawEnd }));
      if (otCancelled) {
        showToast("코어타임 종료 이전이라 야근이 취소되었습니다.");
      }
      if (isCurrentWeek.value) {
        await refreshWeek(updated);
      } else {
        state.value.todayWork = updated;
        state.value.todayStatus = resolveStatus(updated);
      }
      isActTimeManual.value = false;
      isActTimeLocked.value = false;
      syncActTime(new Date());
    });
  }

  function setDayType(dayType: DayType) {
    state.value.todayWork.dayType = dayType;
    if (dayType !== "HOL" && !state.value.todayWork.isOt) {
      state.value.todayWork.remark = null;
    }
    if (isDayOff(dayType)) {
      state.value.todayWork.isOt = false;
      Object.assign(state.value.todayWork, clearAnchors(state.value.todayWork));
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
      Object.assign(work, clearAnchors(work));
    }
    state.value.todayWork = work;
  }

  function setMainEnd(hhmm: string) {
    if (!hhmm) {
      return;
    }
    const work = state.value.todayWork;
    const mainEnd = hhmmToDateTime(work.workDate, hhmm);
    if (!work.rawEnd) {
      const anchors = syncFromMainEnd(work.workDate, mainEnd);
      state.value.todayWork = { ...work, ...anchors };
      return;
    }
    state.value.todayWork = withOtRecalc(work, "main_end", { mainEnd });
  }

  function setOtStart(hhmm: string) {
    if (!hhmm) {
      return;
    }
    const work = state.value.todayWork;
    const otStart = hhmmToDateTime(work.workDate, hhmm);
    if (!work.rawEnd) {
      const anchors = syncFromOtStart(work.workDate, otStart);
      state.value.todayWork = { ...work, ...anchors };
      return;
    }
    state.value.todayWork = withOtRecalc(work, "ot_start", { otStart });
  }

  function setWorkSettings(payload: { dayType: DayType; isOt: boolean; remark: string | null }) {
    const finalIsOt = isDayOff(payload.dayType) ? false : payload.isOt;
    const finalRemark =
      payload.dayType === "HOL" || finalIsOt ? payload.remark?.trim() || null : null;

    const work: Work = {
      ...state.value.todayWork,
      dayType: payload.dayType,
      isOt: finalIsOt,
      remark: finalRemark
    };

    if (!finalIsOt) {
      Object.assign(work, clearAnchors(work));
    }

    state.value.todayWork = work;
  }

  async function saveWorkSettings() {
    await runAction(async () => {
      const work = state.value.todayWork;
      if (!work.rawEnd) {
        Object.assign(work, clearAnchors(work));
      }
      const updated = await patchWork(userId, toSettingsPatch(work));
      await afterWeekEdit(recalcAnchors(updated));
    });
  }

  async function setWeekIn(workDate: string, hhmm: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const rawStart = hhmmToDateTime(workDate, hhmm);
      let work: Work = { ...existing, rawStart };
      if (work.isOt && work.rawEnd) {
        work = withOtRecalc(work, "raw_start");
      }
      const updated = await checkIn(userId, toWorkPatch(work, { rawStart, workDate }));
      await afterWeekEdit(updated);
    });
  }

  async function setWeekOut(workDate: string, hhmm: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      if (!canCheckoutHalfDay(existing.dayType, hhmm)) {
        throw new Error(`오후반차는 ${WorkPolicy.HALF_DAY_HHMM} 이후에만 퇴근할 수 있습니다.`);
      }
      const rawEnd = hhmmToDateTime(workDate, hhmm);
      const { work } = otOnCheckout({ ...existing, rawEnd }, rawEnd!);
      const updated = await checkOut(userId, toWorkPatch(work, { rawEnd, workDate }));
      await afterWeekEdit(updated);
    });
  }

  async function setWeekMainEnd(workDate: string, hhmm: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const mainEnd = hhmmToDateTime(workDate, hhmm);
      let work: Work;
      if (existing.rawEnd) {
        work = withOtRecalc({ ...existing, mainEnd }, "main_end", { mainEnd });
      } else {
        const anchors = syncFromMainEnd(workDate, mainEnd);
        work = { ...existing, ...anchors };
      }
      const updated = await patchWork(userId, toWorkPatch(work, { workDate }));
      await afterWeekEdit(updated);
    });
  }

  async function setWeekOtStart(workDate: string, hhmm: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const otStart = hhmmToDateTime(workDate, hhmm);
      const work = withOtRecalc({ ...existing, otStart }, "ot_start", { otStart });
      const updated = await patchWork(userId, toWorkPatch(work, { workDate }));
      await afterWeekEdit(updated);
    });
  }

  async function setWeekOtEnd(workDate: string, hhmm: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const otEnd = hhmmToDateTime(workDate, hhmm);
      const work = withOtRecalc({ ...existing, otEnd }, "ot_end", { otEnd });
      const updated = await patchWork(userId, toWorkPatch(work, { workDate }));
      await afterWeekEdit(updated);
    });
  }

  async function clearWeekIn(workDate: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const updated = await patchWork(userId, {
        workDate,
        dayType: existing.dayType,
        isOt: existing.isOt,
        remark: remarkForApi(existing),
        clearRawStart: true,
        clearMainEnd: true,
        clearOtStart: true,
        clearOtEnd: true
      });
      await afterWeekEdit(updated);
    });
  }

  async function clearWeekOut(workDate: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const updated = await patchWork(userId, {
        workDate,
        dayType: existing.dayType,
        isOt: existing.isOt,
        remark: remarkForApi(existing),
        clearRawEnd: true,
        clearMainEnd: true,
        clearOtStart: true,
        clearOtEnd: true
      });
      await afterWeekEdit(updated);
    });
  }

  async function clearWeekOtStart(workDate: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const updated = await patchWork(
        userId,
        toSettingsPatch(existing, {
          workDate,
          clearMainEnd: true,
          clearOtStart: true
        })
      );
      await afterWeekEdit(recalcAnchors(updated));
    });
  }

  async function clearWeekOtEnd(workDate: string) {
    await runAction(async () => {
      const existing = await fetchWork(userId, workDate);
      const updated = await patchWork(
        userId,
        toSettingsPatch(existing, {
          workDate,
          clearOtEnd: true
        })
      );
      await afterWeekEdit(updated.rawEnd ? updated : recalcAnchors(updated));
    });
  }

  async function saveWeekSettings(payload: DaySettings) {
    await runAction(async () => {
      const existing = await fetchWork(userId, payload.workDate);
      const finalIsOt = isDayOff(payload.dayType) ? false : payload.isOt;
      const finalRemark =
        payload.dayType === "HOL" || finalIsOt ? payload.remark?.trim() || null : null;

      let work: Work = {
        ...existing,
        dayType: payload.dayType,
        isOt: finalIsOt,
        remark: finalRemark
      };

      if (!finalIsOt) {
        Object.assign(work, clearAnchors(work));
      }

      const settingsOverride: WorkPatch = {
        workDate: payload.workDate,
        dayType: payload.dayType,
        isOt: finalIsOt,
        remark: finalRemark
      };

      let updated: Work;
      if (!finalIsOt) {
        updated = await patchWork(
          userId,
          toSettingsPatch(work, settingsOverride)
        );
      } else if (!existing.isOt && finalIsOt && work.rawStart && work.rawEnd) {
        work = withOtRecalc(work, "auto");
        updated = await patchWork(
          userId,
          toWorkPatch(work, settingsOverride)
        );
      } else {
        updated = await patchWork(
          userId,
          toSettingsPatch(work, settingsOverride)
        );
      }
      await afterWeekEdit(recalcAnchors(updated));
    });
  }

  async function afterWeekEdit(updated: Work) {
    await refreshWeek(updated);
  }

  async function shiftWeek(delta: number) {
    if (state.value.loading || state.value.actionLoading) {
      return;
    }
    state.value.loading = true;
    state.value.errorMessage = null;
    try {
      referenceDate.value = shiftDateKey(referenceDate.value, delta * 7);
      await loadWeekReport();
      state.value.lastSyncedAt = new Date().toISOString();
    } catch (error) {
      state.value.errorMessage = apiErrMsg(error);
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
      await loadWeekReport();
      state.value.lastSyncedAt = new Date().toISOString();
    } catch (error) {
      state.value.errorMessage = apiErrMsg(error);
    } finally {
      state.value.loading = false;
    }
  }

  async function retry() {
    await loadDashboard();
  }

  async function runAction(callback: () => Promise<void>) {
    loadGen += 1;
    state.value.actionLoading = true;
    state.value.errorMessage = null;
    try {
      await callback();
      state.value.lastSyncedAt = new Date().toISOString();
    } catch (error) {
      state.value.errorMessage = apiErrMsg(error);
    } finally {
      state.value.actionLoading = false;
    }
  }

  onMounted(() => {
    void loadDashboard();
  });

  onUnmounted(() => {
    if (toastTimerId !== null) {
      window.clearTimeout(toastTimerId);
    }
  });

  return {
    state,
    referenceDate,
    isCurrentWeek,
    actTime,
    isActTimeEditable,
    isActTimeLocked,
    applyPickedTime,
    syncActTime,
    onClockTick,
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
    saveWeekSettings
  };
}

function otOnCheckout(
  work: Work,
  rawEnd: string
): { work: Work; cancelled: boolean } {
  if (!work.isOt) {
    return { work: { ...work, rawEnd }, cancelled: false };
  }

  const checkoutAt = new Date(rawEnd.replace(" ", "T"));
  if (shouldCancelOt(work.workDate, checkoutAt)) {
    const next = { ...work, rawEnd, isOt: false };
    return { work: clearAnchors(next), cancelled: true };
  }

  let next = withOtRecalc({ ...work, rawEnd }, "raw_end");
  const calc = withCalc({ ...next, rawEnd });
  const mainEndDt = calc.mainEnd ? new Date(calc.mainEnd.replace(" ", "T")) : null;
  const hasExtra = calc.extra1 + calc.extra2 > 0;
  const eligible =
    mainEndDt != null &&
    !isBeforeCore(mainEndDt, work.workDate) &&
    calc.otStart != null;

  if (!eligible || !hasExtra) {
    next = { ...next, rawEnd, isOt: false };
    return { work: clearAnchors(next), cancelled: true };
  }

  return { work: next, cancelled: false };
}

/** 근무 설정 저장: isOt·remark·dayType만 전송. 퇴근 전에는 앵커 필드도 DB에서 비움. */
function toSettingsPatch(work: Work, override: WorkPatch = {}): WorkPatch {
  const { mainEnd: _mainEnd, otStart: _otStart, otEnd: _otEnd, ...safeOverride } = override;
  const hasCheckout = Boolean(safeOverride.rawEnd ?? work.rawEnd);
  return {
    workDate: work.workDate,
    dayType: safeOverride.dayType ?? work.dayType,
    isOt: safeOverride.isOt ?? work.isOt,
    remark:
      safeOverride.remark !== undefined ? safeOverride.remark : remarkForApi(work),
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

function clearAnchors(work: Work): Work {
  return { ...work, mainEnd: null, otStart: null, otEnd: null };
}

function recalcAnchors(work: Work): Work {
  if (work.rawEnd) {
    return work;
  }
  return withCalc(clearAnchors(work));
}

function toWorkPatch(work: Work, override: WorkPatch = {}): WorkPatch {
  const hasCheckout = Boolean(override.rawEnd ?? work.rawEnd);
  const merged = { ...work, ...override };
  const mainStart = merged.rawStart ?? null;

  if (!hasCheckout) {
    return {
      ...toSettingsPatch(work, override),
      mainStart
    };
  }

  const calc = withCalc(merged);
  return {
    workDate: work.workDate,
    dayType: merged.dayType,
    isOt: merged.isOt,
    remark: remarkForApi(merged),
    mainEnd: calc.mainEnd,
    mainStart,
    otStart: calc.otStart,
    otEnd: calc.otEnd,
    clearMainEnd: calc.mainEnd == null,
    clearOtStart: !merged.isOt || !calc.otStart,
    clearOtEnd: !merged.isOt,
    ...override
  };
}

function remarkForApi(work: Work): string | null {
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

function mergeWeekToday(weekly: WeekReport, today: Work, asOf = new Date()): WeekReport {
  const todayDate = localDateKey(asOf);
  const calculatedToday = withCalc(today, asOf);
  const days = weekly.days.map((day) => mergeDayToday(day, calculatedToday, todayDate));
  const mainMin = days.reduce((sum, day) => sum + day.main, 0);
  const baseMin = weekly.summary.baseMin;
  const remMin = Math.max(baseMin - mainMin, 0);
  const daysAfterCount = remainDays(todayDate, weekly.weekEnd, today.rawEnd);
  const avgPerDayMin = avgPerDay(
    remMin,
    daysAfterCount
  );

  return {
    ...weekly,
    summary: {
      mainMin,
      baseMin,
      remMin,
      avgPerDayMin,
      daysAfter: daysAfterCount
    },
    days
  };
}

function mergeDayToday(day: WeekDay, today: Work, todayDate: string): WeekDay {
  if (day.workDate !== todayDate) {
    return day;
  }

  const dayOff = isDayOff(today.dayType);

  return {
    ...day,
    rawStart: dayOff ? null : today.rawStart,
    rawEnd: dayOff ? null : today.rawEnd,
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
