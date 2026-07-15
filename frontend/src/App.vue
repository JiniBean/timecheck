<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "./stores/auth";
import { useBootStore } from "./stores/boot";
import { bootLog } from "./utils/bootLog";

const authStore = useAuthStore();
const bootStore = useBootStore();
const route = useRoute();

/** 인증 게이트: 보호 라우트는 user 있을 때만 router-view 마운트 */
const canShowRoute = computed(() => {
  if (!authStore.initialized) {
    return false;
  }
  if (route.meta.requiresAuth && !authStore.user) {
    return false;
  }
  return true;
});

/**
 * 스플래시: 부트 중, 보호 라우트 리다이렉트 대기, 또는
 * 대시보드 데이터(loadDashboard) 완료 전
 */
const isBooting = computed(() => {
  if (!authStore.initialized) {
    return true;
  }
  if (route.meta.requiresAuth && !authStore.user) {
    return true;
  }
  if (route.name === "dashboard" && authStore.user && !bootStore.shellReady) {
    return true;
  }
  return false;
});

watch(
  () => ({
    initialized: authStore.initialized,
    name: route.name,
    hasUser: Boolean(authStore.user)
  }),
  ({ initialized, name, hasUser }) => {
    if (!initialized) {
      return;
    }
    if (name === "dashboard" && hasUser) {
      return;
    }
    if (name === "login" || name === "signup" || !hasUser) {
      bootStore.markShellReady();
    }
  }
);

onMounted(() => {
  bootLog("app.mounted", { initialized: authStore.initialized });
  void authStore.bootstrap();
});
</script>

<template>
  <router-view v-if="canShowRoute" />
  <div v-if="isBooting" class="app-splash" role="status" aria-live="polite" aria-label="앱을 불러오는 중">
    <div class="app-splash__content">
      <img class="app-splash__icon" src="/pwa-192x192.png" alt="" width="96" height="96" />
      <p class="app-splash__title">TimeCheck</p>
      <p class="app-splash__subtitle">근무시간 계산기</p>
      <div class="app-splash__spinner" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.app-splash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg);
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
  box-shadow: 0 12px 28px var(--color-primary-shadow);
}

.app-splash__title {
  margin: 8px 0 0;
  font-size: var(--font-title);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
}

.app-splash__subtitle {
  margin: 0;
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.app-splash__spinner {
  width: 28px;
  height: 28px;
  margin-top: 20px;
  border: 3px solid var(--color-primary-ring-faint);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: app-splash-spin 0.8s linear infinite;
}

@keyframes app-splash-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
