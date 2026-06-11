<script setup lang="ts">
import type { MainSummaryResult } from "../../utils/main";
import { formatHmFromMinutes } from "../../utils/time";

defineProps<{
  summary: MainSummaryResult;
}>();
</script>

<template>
  <section class="card card-ot-summary">
    <div class="stat-row stat-row--3 stat-row--ot">
      <div class="stat-item">
        <p class="stat-label">1형</p>
        <p class="stat-value">{{ formatHmFromMinutes(summary.weekExtra1Minutes) }}</p>
      </div>
      <div class="stat-item stat-item--divider">
        <p class="stat-label">2형</p>
        <p class="stat-value">{{ formatHmFromMinutes(summary.weekExtra2Minutes) }}</p>
      </div>
      <div class="stat-item stat-item--divider">
        <p class="stat-label">합계</p>
        <p class="stat-value">{{ formatHmFromMinutes(summary.weekExtraTotalMinutes) }}</p>
      </div>
    </div>
  </section>
</template>
