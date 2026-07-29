<script setup lang="ts">
import type { SummaryOut } from "../../utils/main";
import { formatMinutes } from "../../utils/time";

defineProps<{
  summary: SummaryOut;
}>();
</script>

<template>
  <section class="card card-ot-summary">
    <div class="stat-row stat-row--3 stat-row--ot">
      <div class="stat-item">
        <p class="stat-label">1형</p>
        <p class="stat-value">{{ formatMinutes(summary.weekExtra1) }}</p>
      </div>
      <div class="stat-item stat-item--divider">
        <p class="stat-label">2형</p>
        <p class="stat-value">{{ formatMinutes(summary.weekExtra2) }}</p>
      </div>
      <div class="stat-item stat-item--divider">
        <p class="stat-label">합계</p>
        <p class="stat-value">{{ formatMinutes(summary.weekExtraTotal) }}</p>
      </div>
    </div>
  </section>
</template>
