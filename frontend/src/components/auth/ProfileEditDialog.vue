<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AuthUser, ProfileForm } from "../../types/auth";
import { useAuthStore } from "../../stores/auth";
import { useUsernameField } from "../../composables/useUsernameField";
import { getApiErrorMessage } from "../../utils/apiError";

const props = defineProps<{
  visible: boolean;
  user: AuthUser;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const authStore = useAuthStore();

const form = ref<ProfileForm>(createFormFromUser(props.user));
const errorMessage = ref<string | null>(null);
const loading = ref(false);

const username = computed({
  get: () => form.value.username,
  set: (value: string) => {
    form.value.username = value;
  }
});
const except = computed(() => props.user.username);
const { usernameError, busy, touch, reset } = useUsernameField(username, { except });

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      form.value = createFormFromUser(props.user);
      errorMessage.value = null;
      reset();
    }
  }
);

watch(
  () => props.user,
  (user) => {
    if (props.visible) {
      form.value = createFormFromUser(user);
    }
  }
);

function createFormFromUser(user: AuthUser): ProfileForm {
  return {
    username: user.username,
    password: "",
    name: user.name,
    department: user.department ?? "",
    team: user.team ?? "",
    position: user.position ?? ""
  };
}

function close() {
  if (!loading.value) {
    emit("close");
  }
}

async function handleSubmit() {
  touch();
  if (usernameError.value || busy.value) {
    return;
  }

  errorMessage.value = null;
  loading.value = true;
  try {
    await authStore.updateMe(form.value);
    emit("saved");
    emit("close");
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, "회원정보를 저장하지 못했습니다.");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="profile-modal-overlay" @click.self="close">
      <section class="card profile-modal-card" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
        <h2 id="profile-modal-title" class="profile-modal-title">회원정보 변경</h2>
        <p class="profile-modal-subtitle">아이디, 비밀번호, 이름을 수정할 수 있습니다.</p>

        <form class="profile-modal-form" novalidate @submit.prevent="handleSubmit">
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
              placeholder="변경하지 않으려면 비워두세요"
            />
          </label>

          <label class="field">
            <span class="field-label">이름</span>
            <input v-model="form.name" class="text-input" type="text" autocomplete="name" required />
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

          <p v-if="errorMessage" class="profile-modal-error">{{ errorMessage }}</p>

          <div class="profile-modal-actions">
            <button type="button" class="button button-soft button-sm" :disabled="loading" @click="close">
              취소
            </button>
            <button type="submit" class="button button-primary button-sm" :disabled="loading || !!usernameError || busy">
              {{ loading ? "저장 중..." : "저장" }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.profile-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: var(--color-overlay);
}

.profile-modal-card {
  width: min(100%, 420px);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}

.profile-modal-title {
  margin: 0 0 8px;
  font-size: var(--font-title);
}

.profile-modal-subtitle {
  margin: 0 0 20px;
  color: var(--color-text-muted);
  font-size: var(--font-base);
}

.profile-modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.profile-modal-error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-sm);
}

.profile-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
</style>
