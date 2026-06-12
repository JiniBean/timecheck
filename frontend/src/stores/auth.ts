import { defineStore } from "pinia";
import { computed, ref } from "vue";
import * as authApi from "../api/auth";
import type { AuthUser, LoginForm, ProfileForm, SignupForm } from "../types/auth";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const initialized = ref(false);
  const isAdmin = computed(() => user.value?.role === "ADMIN");

  async function bootstrap() {
    try {
      user.value = await authApi.fetchMe();
    } finally {
      initialized.value = true;
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
    } finally {
      user.value = null;
    }
  }

  async function updateUser(form: ProfileForm) {
    user.value = await authApi.updateUser(form);
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
    updateUser: updateUser,
    clearUser
  };
});
