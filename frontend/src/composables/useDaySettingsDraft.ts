import { ref } from "vue";
import type { DayType } from "../types/dashboard";
import { isDayOff } from "../utils/dayType";

export interface DaySettings {
  dayType: DayType;
  isOt: boolean;
  remark: string | null;
}

export function useDaySettingsDraft() {
  const dayTypeDraft = ref<DayType>("NOM");
  const otDraft = ref(false);
  const remarkDraft = ref("");

  function loadDraft(values: DaySettings) {
    dayTypeDraft.value = values.dayType;
    otDraft.value = values.isOt;
    remarkDraft.value = values.remark ?? "";
  }

  function setDayType(dayType: DayType) {
    dayTypeDraft.value = dayType;
    if (isDayOff(dayType)) {
      otDraft.value = false;
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

  function buildPayload(): DaySettings {
    const showRemark =
      dayTypeDraft.value === "HOL" || (otDraft.value && !isDayOff(dayTypeDraft.value));
    return {
      dayType: dayTypeDraft.value,
      isOt: isDayOff(dayTypeDraft.value) ? false : otDraft.value,
      remark: showRemark ? remarkDraft.value.trim() || null : null
    };
  }

  return {
    dayTypeDraft,
    otDraft,
    remarkDraft,
    loadDraft,
    setDayType,
    onToggleOt,
    setRemark,
    buildPayload
  };
}
