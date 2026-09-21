import { ref } from "vue";
import type { DayType } from "../types/dashboard";
import { isDayOff } from "../utils/dayType";
import { WorkPolicy, hmOf } from "../utils/workPolicy";

export interface DaySettings {
  dayType: DayType;
  isOt: boolean;
  remark: string | null;
  lateIn: string | null;
  earlyOut: string | null;
}

function normalizeHm(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const hm = value.slice(0, 5);
  return /^\d{2}:\d{2}$/.test(hm) ? hm : null;
}

/** STD와 같으면 미설정(NULL). */
function shortHm(value: string | null, std: string): string | null {
  const hm = normalizeHm(value);
  return hm && hm !== std ? hm : null;
}

export function useDaySettingsDraft() {
  const dayTypeDraft = ref<DayType>("NOM");
  const otDraft = ref(false);
  const remarkDraft = ref("");
  const lateInDraft = ref<string | null>(null);
  const earlyOutDraft = ref<string | null>(null);

  function loadDraft(values: DaySettings) {
    dayTypeDraft.value = values.dayType;
    otDraft.value = values.isOt;
    remarkDraft.value = values.remark ?? "";
    lateInDraft.value = normalizeHm(values.lateIn);
    earlyOutDraft.value = normalizeHm(values.earlyOut);
  }

  function setDayType(dayType: DayType) {
    dayTypeDraft.value = dayType;
    if (isDayOff(dayType)) {
      otDraft.value = false;
    }
    if (dayType !== "NOM") {
      lateInDraft.value = null;
      earlyOutDraft.value = null;
    }
  }

  function onToggleOt() {
    if (isDayOff(dayTypeDraft.value)) {
      return;
    }
    otDraft.value = !otDraft.value;
  }

  function setRemark(value: string) {
    remarkDraft.value = value;
  }

  function setLateIn(value: string | null) {
    lateInDraft.value = normalizeHm(value);
  }

  function setEarlyOut(value: string | null) {
    earlyOutDraft.value = normalizeHm(value);
  }

  function buildPayload(): DaySettings {
    const isNom = dayTypeDraft.value === "NOM";
    const lateIn = isNom ? shortHm(lateInDraft.value, hmOf(WorkPolicy.STD_START)) : null;
    const earlyOut = isNom ? shortHm(earlyOutDraft.value, hmOf(WorkPolicy.STD_END)) : null;
    const hasShortWork = Boolean(lateIn || earlyOut);
    const showRemark =
      dayTypeDraft.value === "HOL" ||
      (otDraft.value && !isDayOff(dayTypeDraft.value)) ||
      hasShortWork;
    return {
      dayType: dayTypeDraft.value,
      isOt: isDayOff(dayTypeDraft.value) ? false : otDraft.value,
      remark: showRemark ? remarkDraft.value.trim() || null : null,
      lateIn,
      earlyOut
    };
  }

  return {
    dayTypeDraft,
    otDraft,
    remarkDraft,
    lateInDraft,
    earlyOutDraft,
    loadDraft,
    setDayType,
    onToggleOt,
    setRemark,
    setLateIn,
    setEarlyOut,
    buildPayload
  };
}
