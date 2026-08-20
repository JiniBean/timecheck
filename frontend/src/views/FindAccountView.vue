<script setup lang="ts">
import { ref, watch } from "vue";
import { findUsername, resetPassword, verifyAccount } from "../api/auth";
import { apiErrMsg } from "../utils/apiError";
import type { PasswordResetForm, UsernameFindForm } from "../types/auth";

type ActiveTab = "username" | "password";

const activeTab = ref<ActiveTab>("username");
const usernameFindForm = ref<UsernameFindForm>({ name: "", department: "" });
const passwordResetForm = ref<PasswordResetForm>({
  username: "",
  name: "",
  password: "",
  confirmPassword: ""
});
const foundUsername = ref<string | null>(null);
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const isAccountVerified = ref(false);
const isVerifyingAccount = ref(false);

let verifyTimer: ReturnType<typeof setTimeout> | null = null;

function switchTab(tab: ActiveTab) {
  activeTab.value = tab;
  errorMessage.value = null;
  successMessage.value = null;
  foundUsername.value = null;
  isAccountVerified.value = false;
}

watch(
  () => [passwordResetForm.value.username, passwordResetForm.value.name],
  () => {
    isAccountVerified.value = false;
    errorMessage.value = null;

    if (verifyTimer) clearTimeout(verifyTimer);

    const { username, name } = passwordResetForm.value;
    if (!username.trim() || !name.trim()) return;

    verifyTimer = setTimeout(async () => {
      isVerifyingAccount.value = true;
      try {
        await verifyAccount({ username: username.trim(), name: name.trim() });
        isAccountVerified.value = true;
        errorMessage.value = null;
      } catch (error) {
        isAccountVerified.value = false;
        errorMessage.value = apiErrMsg(error, "계정 확인에 실패했습니다.");
      } finally {
        isVerifyingAccount.value = false;
      }
    }, 300);
  }
);

async function handleFindUsername() {
  errorMessage.value = null;
  successMessage.value = null;
  foundUsername.value = null;
  isLoading.value = true;
  try {
    foundUsername.value = await findUsername(usernameFindForm.value);
  } catch (error) {
    errorMessage.value = apiErrMsg(error, "아이디 찾기에 실패했습니다.");
  } finally {
    isLoading.value = false;
  }
}

async function handleResetPassword() {
  errorMessage.value = null;
  successMessage.value = null;

  if (!isAccountVerified.value) {
    const { username, name } = passwordResetForm.value;
    isVerifyingAccount.value = true;
    try {
      await verifyAccount({ username: username.trim(), name: name.trim() });
      isAccountVerified.value = true;
    } catch (error) {
      isAccountVerified.value = false;
      errorMessage.value = apiErrMsg(error, "계정 확인에 실패했습니다.");
      isVerifyingAccount.value = false;
      return;
    }
    isVerifyingAccount.value = false;
  }

  const { password, confirmPassword } = passwordResetForm.value;
  if (password !== confirmPassword) {
    errorMessage.value = "비밀번호가 일치하지 않습니다.";
    return;
  }

  isLoading.value = true;
  try {
    const { username, name, password: pwd } = passwordResetForm.value;
    await resetPassword({ username, name, password: pwd });
    successMessage.value = "비밀번호가 재설정되었습니다. 로그인해 주세요.";
    passwordResetForm.value = { username: "", name: "", password: "", confirmPassword: "" };
  } catch (error) {
    errorMessage.value = apiErrMsg(error, "비밀번호 재설정에 실패했습니다.");
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="card auth-card">
      <h1 class="auth-title">계정찾기</h1>

      <div class="auth-tabs">
        <button
          type="button"
          class="auth-tab"
          :class="{ 'auth-tab--active': activeTab === 'username' }"
          @click="switchTab('username')"
        >
          아이디 찾기
        </button>
        <button
          type="button"
          class="auth-tab"
          :class="{ 'auth-tab--active': activeTab === 'password' }"
          @click="switchTab('password')"
        >
          비밀번호 재설정
        </button>
      </div>

      <template v-if="activeTab === 'username'">
        <div class="auth-body" :class="{ 'auth-body--centered': foundUsername }">
          <form v-if="!foundUsername" class="auth-form" @submit.prevent="handleFindUsername">
            <label class="field">
              <span class="field-label">이름</span>
              <input
                v-model="usernameFindForm.name"
                class="text-input"
                type="text"
                autocomplete="name"
                required
              />
            </label>

            <label class="field">
              <span class="field-label">부서</span>
              <input
                v-model="usernameFindForm.department"
                class="text-input"
                type="text"
                autocomplete="organization"
                placeholder="예: 연구개발실"
                required
              />
            </label>

            <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>

            <button class="button button-primary auth-submit" type="submit" :disabled="isLoading">
              {{ isLoading ? "찾는 중..." : "아이디 찾기" }}
            </button>
          </form>

          <div v-else class="auth-result">
            <p class="auth-success">회원님의 아이디는 <strong>{{ foundUsername }}</strong> 입니다.</p>
            <router-link class="button button-primary auth-submit" to="/login">로그인하기</router-link>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="auth-body" :class="{ 'auth-body--centered': successMessage }">
          <form v-if="!successMessage" class="auth-form" @submit.prevent="handleResetPassword">
            <label class="field">
              <span class="field-label">아이디</span>
              <input
                v-model="passwordResetForm.username"
                class="text-input"
                type="text"
                autocomplete="username"
                required
              />
            </label>

            <label class="field">
              <span class="field-label">이름</span>
              <input
                v-model="passwordResetForm.name"
                class="text-input"
                type="text"
                autocomplete="name"
                required
              />
            </label>

            <label class="field">
              <span class="field-label">새 비밀번호</span>
              <input
                v-model="passwordResetForm.password"
                class="text-input"
                type="password"
                autocomplete="new-password"
                minlength="4"
                required
                :disabled="!isAccountVerified"
              />
            </label>

            <label class="field">
              <span class="field-label">새 비밀번호 확인</span>
              <input
                v-model="passwordResetForm.confirmPassword"
                class="text-input"
                type="password"
                autocomplete="new-password"
                minlength="4"
                required
                :disabled="!isAccountVerified"
              />
            </label>

            <p v-if="isVerifyingAccount" class="auth-hint">계정 확인 중...</p>
            <p v-if="errorMessage" class="auth-error">{{ errorMessage }}</p>

            <button
              class="button button-primary auth-submit"
              type="submit"
              :disabled="isLoading || isVerifyingAccount"
            >
              {{ isLoading ? "재설정 중..." : "비밀번호 재설정" }}
            </button>
          </form>

          <div v-else class="auth-result">
            <p class="auth-success">{{ successMessage }}</p>
            <router-link class="button button-primary auth-submit" to="/login">로그인하기</router-link>
          </div>
        </div>
      </template>

      <p v-if="!successMessage && !foundUsername" class="auth-footer">
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
  margin: 0 0 16px;
  font-size: var(--font-title);
}

.auth-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.auth-tab {
  flex: 1;
  padding: 10px 8px;
  border: none;
  background: none;
  font-size: var(--font-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.auth-tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

.auth-body {
  min-height: 320px;
}

.auth-body--centered {
  display: flex;
  flex-direction: column;
  justify-content: center;
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

.auth-hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.auth-success {
  margin: 0 0 16px;
  font-size: var(--font-sm);
  color: var(--color-text);
  text-align: center;
}

.auth-result {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-submit {
  width: 100%;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  box-sizing: border-box;
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
