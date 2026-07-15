import { defineStore } from "pinia";
import { computed, ref } from "vue";
import * as authApi from "../api/auth";
import type { AuthUser, LoginForm, ProfileForm, SignupForm } from "../types/auth";
import { bootError, bootLog } from "../utils/bootLog";
import { useBootStore } from "./boot";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const initialized = ref(false);
  const isAdmin = computed(() => user.value?.role === "ADMIN");

  let bootstrapTask: Promise<void> | null = null;

  async function bootstrap() {
    if (initialized.value) {
      bootLog("bootstrap.skip", { reason: "already_initialized" });
      return;
    }
    if (!bootstrapTask) {
      bootstrapTask = runBootstrap();
    }
    await bootstrapTask;
  }

  async function runBootstrap() {
    bootLog("bootstrap.start");
    try {
      user.value = await authApi.fetchMe();
      bootLog("bootstrap.done", { hasUser: Boolean(user.value), userId: user.value?.userId ?? null });
    } catch (error) {
      user.value = null;
      bootError("bootstrap.error", error);
    } finally {
      initialized.value = true;
      bootLog("bootstrap.initialized", { initialized: initialized.value });
    }
  }

  async function login(form: LoginForm) {
    user.value = await authApi.login(form);
  }

  async function signup(form: SignupForm) {
    user.value = await authApi.signup(form);
  }

  async function logout() {
    try {
      await authApi.logout();
      bootLog("logout.ok");
    } catch (error) {
      const status =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { status?: number } }).response?.status ?? null
          : null;
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code ?? "")
          : "";
      bootError("logout.error", error, { status, code });
    } finally {
      user.value = null;
      useBootStore().resetShellReady();
    }
  }

  async function updateMe(form: ProfileForm) {
    user.value = await authApi.updateMe(form);
  }

  function clearUser() {
    user.value = null;
  }

  return {
    user,
    initialized,
    isAdmin,
    bootstrap,
    login,
    signup,
    logout,
    updateMe,
    clearUser
  };
});
