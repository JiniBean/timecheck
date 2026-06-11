import { defineStore } from "pinia";
import { ref } from "vue";
import * as authApi from "../api/auth";
import type { AuthUser, LoginForm, ProfileForm, SignupForm } from "../types/auth";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const initialized = ref(false);

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

  async function updateProfile(form: ProfileForm) {
    user.value = await authApi.updateProfile(form);
  }

  function clearUser() {
    user.value = null;
  }

  return {
    user,
    initialized,
    bootstrap,
    login,
    signup,
    logout,
    updateProfile,
    clearUser
  };
});
