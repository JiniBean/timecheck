<script setup lang="ts">
export type WorkTab = "main" | "ot";

const model = defineModel<WorkTab>({ required: true });

const tabs: { id: WorkTab; label: string }[] = [
  { id: "main", label: "일반 근무" },
  { id: "ot", label: "시간외 근무" }
];
</script>

<template>
  <div class="dashboard-mobile-tabs" role="tablist" aria-label="근무 구분">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="dashboard-mobile-tab"
      :class="{ 'is-active': model === tab.id }"
      role="tab"
      :aria-selected="model === tab.id"
      :tabindex="model === tab.id ? 0 : -1"
      @click="model = tab.id"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
