<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import type { LoginForm } from "../types/auth";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const form = ref<LoginForm>({
  username: "",
  password: ""
});
const errorMessage = ref<string | null>(null);
const loading = ref(false);

async function handleSubmit() {
  errorMessage.value = null;
  loading.value = true;
  try {
    await authStore.login(form.value);
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/";
    await router.replace(redirect);
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, "로그인에 실패했습니다.");
  } finally {
    loading.value = false;
  }
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }
  return fallback;
}
</script>

<template>
  <main class="auth-page">
    <section class="card auth-card">
      <h1 class="auth-title">로그인</h1>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <label class="field">
          <span class="field-label">아이디</span>
          <input
            v-model="form.username"
            class="text-input"
            type="text"
            autocomplete="username"
            required
          />
        </label>

        <label class="field">
          <span class="field-label">비밀번호</span>
          <input
            v-model="form.password"
            class="text-input"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>

        <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>

        <button class="button button-primary auth-submit" type="submit" :disabled="loading">
          {{ loading ? "로그인 중..." : "로그인" }}
        </button>
      </form>

      <p class="auth-footer">
        계정이 없으신가요?
        <router-link to="/signup">회원가입</router-link>
      </p>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.auth-card {
  width: min(100%, 420px);
}

.auth-title {
  margin: 0 0 8px;
  font-size: var(--font-title);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-sm);
}

.auth-submit {
  width: 100%;
}

.auth-footer {
  margin: 18px 0 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.auth-footer a {
  color: var(--color-primary);
  text-decoration: none;
}
</style>
