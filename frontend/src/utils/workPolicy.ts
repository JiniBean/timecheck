/** Java {@link com.timecheck.policy.WorkPolicy} 와 동일 */
export const WorkPolicy = {
  STD_WORK: 480,
  STD_HALF: 240,
  HALF_DAY_BOUNDARY: { hour: 14, minute: 0 },
  HALF_DAY_HHMM: "14:00",
  BREAK_BASE: 60,
  BREAK_MAIN: 0,
  BREAK_OVER: 60,
  STD_START: { hour: 9, minute: 0 },
  STD_END: { hour: 18, minute: 0 },
  CORE_START: { hour: 10, minute: 0 },
  CORE_END: { hour: 16, minute: 0 },
  LUNCH_START: { hour: 11, minute: 30 },
  LUNCH_END: { hour: 12, minute: 30 },
  OT_SPLIT: { hour: 22, minute: 0 }
} as const;
