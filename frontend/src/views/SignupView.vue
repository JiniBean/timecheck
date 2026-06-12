<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useUsernameField } from "../composables/useUsernameField";
import { getApiErrorMessage } from "../utils/apiError";
import type { SignupForm } from "../types/auth";

const authStore = useAuthStore();
const router = useRouter();

const form = ref<SignupForm>({
  username: "",
  password: "",
  userName: "",
  department: "",
  team: "",
  position: ""
});
const errorMessage = ref<string | null>(null);
const loading = ref(false);

const username = computed({
  get: () => form.value.username,
  set: (value: string) => {
    form.value.username = value;
  }
});
const { usernameError, busy, touch } = useUsernameField(username);

async function handleSubmit() {
  touch();
  if (usernameError.value || busy.value) {
    return;
  }

  errorMessage.value = null;
  loading.value = true;
  try {
    await authStore.signup(form.value);
    await router.replace("/");
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "회원가입에 실패했습니다.");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="card auth-card">
      <h1 class="auth-title">회원가입</h1>

      <form class="auth-form" novalidate @submit.prevent="handleSubmit">
        <label class="field">
          <span class="field-label-row">
            <span class="field-label">아이디</span>
            <span v-if="usernameError" class="field-label-feedback">{{ usernameError }}</span>
          </span>
          <input
            v-model="form.username"
            class="text-input"
            :class="{ 'text-input--invalid': usernameError }"
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
            autocomplete="new-password"
            minlength="4"
            required
          />
        </label>

        <label class="field">
          <span class="field-label">이름</span>
          <input v-model="form.userName" class="text-input" type="text" autocomplete="name" required />
        </label>

        <label class="field">
          <span class="field-label">직급</span>
          <input v-model="form.position" class="text-input" type="text" placeholder="예: 사원" />
        </label>

        <label class="field">
          <span class="field-label">부서</span>
          <input v-model="form.department" class="text-input" type="text" placeholder="예: 연구개발실" />
        </label>

        <label class="field">
          <span class="field-label">팀</span>
          <input v-model="form.team" class="text-input" type="text" placeholder="예: FM팀" />
        </label>

        <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>

        <button class="button button-primary auth-submit" type="submit" :disabled="loading || !!usernameError || busy">
          {{ loading ? "가입 중..." : "회원가입" }}
        </button>
      </form>

      <p class="auth-footer">
        이미 계정이 있으신가요?
        <router-link to="/login">로그인</router-link>
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
  margin: 0 0 20px;
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
