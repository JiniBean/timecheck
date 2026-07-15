import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * 셸(스플래시) 준비 상태.
 * - 로그인/가입: auth bootstrap 완료 시 shellReady
 * - 대시보드(로그인됨): loadDashboard 완료 시 shellReady
 */
export const useBootStore = defineStore("boot", () => {
  const shellReady = ref(false);

  function markShellReady() {
    shellReady.value = true;
  }

  function resetShellReady() {
    shellReady.value = false;
  }

  return {
    shellReady,
    markShellReady,
    resetShellReady
  };
});
