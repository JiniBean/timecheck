import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * 셸(스플래시) 준비 상태.
 * - 로그인/가입: auth bootstrap 완료 시 isReady
 * - 대시보드(로그인됨): loadDashboard 완료 시 isReady
 */
export const useBootStore = defineStore("boot", () => {
  const isReady = ref(false);

  function markReady() {
    isReady.value = true;
  }

  function resetReady() {
    isReady.value = false;
  }

  return {
    isReady,
    markReady,
    resetReady
  };
});
