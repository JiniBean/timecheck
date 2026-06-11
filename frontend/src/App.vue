<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "./stores/auth";

const authStore = useAuthStore();
const isBootstrapping = computed(() => !authStore.initialized);
</script>

<template>
  <div v-if="isBootstrapping" class="app-splash" role="status" aria-live="polite" aria-label="앱을 불러오는 중">
    <div class="app-splash__content">
      <img class="app-splash__icon" src="/pwa-192x192.png" alt="" width="96" height="96" />
      <p class="app-splash__title">TimeCheck</p>
      <p class="app-splash__subtitle">근무시간 계산기</p>
      <div class="app-splash__spinner" aria-hidden="true" />
    </div>
  </div>
  <router-view v-else />
</template>

<style scoped>
.app-splash {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f4f6fb;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
    env(safe-area-inset-left);
}

.app-splash__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.app-splash__icon {
  width: 96px;
  height: 96px;
  border-radius: 22px;
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.18);
}

.app-splash__title {
  margin: 8px 0 0;
  font-size: var(--font-title);
  font-weight: 700;
  color: #1f2937;
}

.app-splash__subtitle {
  margin: 0;
  font-size: var(--font-sm);
  color: #64748b;
}

.app-splash__spinner {
  width: 28px;
  height: 28px;
  margin-top: 20px;
  border: 3px solid rgba(37, 99, 235, 0.18);
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: app-splash-spin 0.8s linear infinite;
}

@keyframes app-splash-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
