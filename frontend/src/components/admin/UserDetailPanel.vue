<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import type { AdminUser, AdminUserUpdateForm } from "../../types/admin";
import { adminStatusLabel, formatAdminDate } from "../../utils/admin";
import { weekSummary } from "../../utils/main";
import { formatHmFromMinutes } from "../../utils/time";

const props = defineProps<{
  user: AdminUser | null;
  weekStart: string;
  weekEnd: string;
  saving: boolean;
  error: string;
}>();

const emit = defineEmits<{
  close: [];
  save: [form: AdminUserUpdateForm];
}>();

const isDesktop = ref(true);

const form = reactive<AdminUserUpdateForm>({
  userName: "",
  department: "",
  team: "",
  position: "",
  role: "USER"
});

let mediaQuery: MediaQueryList | null = null;

function updateViewport() {
  isDesktop.value = mediaQuery?.matches ?? window.innerWidth >= 900;
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === "Escape" && props.user) {
    emit("close");
  }
}

watch(
  () => props.user,
  (user) => {
    if (!user) {
      return;
    }
    form.userName = user.userName;
    form.department = user.department ?? "";
    form.team = user.team ?? "";
    form.position = user.position ?? "";
    form.role = user.role;
  },
  { immediate: true }
);

watch(
  () => props.user,
  (user) => {
    if (user && !isDesktop.value) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }
);

onMounted(() => {
  mediaQuery = window.matchMedia("(min-width: 900px)");
  updateViewport();
  mediaQuery.addEventListener("change", updateViewport);
  window.addEventListener("keydown", handleEscape);
});

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener("change", updateViewport);
  window.removeEventListener("keydown", handleEscape);
  document.body.style.overflow = "";
});

const weekStats = computed(() => {
  if (!props.user || !props.weekStart || !props.weekEnd) {
    return { main: 0, goalMet: false };
  }
  const stats = weekSummary(
    props.user.weekRecords,
    props.weekStart,
    props.weekEnd,
    props.user.userId
  );
  return { main: stats.main, goalMet: stats.goalMet };
});

function submit() {
  emit("save", { ...form });
}

function close() {
  emit("close");
}
</script>

<template>
  <template v-if="user">
    <Teleport v-if="!isDesktop" to="body">
      <div
        class="admin-detail-fullscreen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-detail-title"
      >
        <header class="admin-detail-header admin-detail-header--fullscreen">
          <div>
            <h2 id="admin-detail-title" class="admin-detail-title">사용자 상세</h2>
            <p class="admin-detail-meta">
              @{{ user.username }} · 가입 {{ formatAdminDate(user.createdAt) }}
            </p>
          </div>
          <button type="button" class="admin-detail-close-btn" @click="close">닫기</button>
        </header>

        <div class="admin-detail-body">
          <form class="admin-detail-form" @submit.prevent="submit">
            <label class="field">
              <span class="field-label">이름</span>
              <input v-model="form.userName" class="text-input" type="text" required />
            </label>
            <label class="field">
              <span class="field-label">부서</span>
              <input v-model="form.department" class="text-input" type="text" />
            </label>
            <label class="field">
              <span class="field-label">팀</span>
              <input v-model="form.team" class="text-input" type="text" />
            </label>
            <label class="field">
              <span class="field-label">직급</span>
              <input v-model="form.position" class="text-input" type="text" />
            </label>
            <label class="field">
              <span class="field-label">역할</span>
              <select v-model="form.role" class="select-input">
                <option value="USER">일반 사용자</option>
                <option value="ADMIN">관리자</option>
              </select>
            </label>

            <dl class="admin-detail-stats">
              <div>
                <dt>상태</dt>
                <dd>
                  <span class="admin-status-badge" :data-status="user.status">
                    {{ adminStatusLabel(user.status) }}
                  </span>
                </dd>
              </div>
              <div>
                <dt>최근 활동</dt>
                <dd>{{ user.lastActivityDate ? formatAdminDate(user.lastActivityDate) : "없음" }}</dd>
              </div>
              <div>
                <dt>이번 주 기록</dt>
                <dd>
                  {{ user.weekDays }}일
                  <span v-if="weekStats.goalMet" class="admin-goal-met">달성</span>
                  <span v-else-if="weekStats.main > 0" class="admin-goal-pending">
                    {{ formatHmFromMinutes(weekStats.main) }}
                  </span>
                </dd>
              </div>
              <div>
                <dt>전체 기록</dt>
                <dd>{{ user.totalRecords }}건</dd>
              </div>
            </dl>

            <p v-if="error" class="admin-error">{{ error }}</p>

            <div class="admin-detail-actions">
              <button type="button" class="button button-soft button-sm" @click="close">취소</button>
              <button type="submit" class="button button-primary button-sm" :disabled="saving">
                {{ saving ? "저장 중…" : "저장" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <aside v-else class="admin-detail-panel card">
      <div class="admin-detail-header">
        <h2 class="admin-detail-title">사용자 상세</h2>
        <button type="button" class="admin-detail-close" aria-label="닫기" @click="close">×</button>
      </div>

      <p class="admin-detail-meta">@{{ user.username }} · 가입 {{ formatAdminDate(user.createdAt) }}</p>

      <form class="admin-detail-form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">이름</span>
          <input v-model="form.userName" class="text-input" type="text" required />
        </label>
        <label class="field">
          <span class="field-label">부서</span>
          <input v-model="form.department" class="text-input" type="text" />
        </label>
        <label class="field">
          <span class="field-label">팀</span>
          <input v-model="form.team" class="text-input" type="text" />
        </label>
        <label class="field">
          <span class="field-label">직급</span>
          <input v-model="form.position" class="text-input" type="text" />
        </label>
        <label class="field">
          <span class="field-label">역할</span>
          <select v-model="form.role" class="select-input">
            <option value="USER">일반 사용자</option>
            <option value="ADMIN">관리자</option>
          </select>
        </label>

        <dl class="admin-detail-stats">
          <div>
            <dt>상태</dt>
            <dd>
              <span class="admin-status-badge" :data-status="user.status">
                {{ adminStatusLabel(user.status) }}
              </span>
            </dd>
          </div>
          <div>
            <dt>최근 활동</dt>
            <dd>{{ user.lastActivityDate ? formatAdminDate(user.lastActivityDate) : "없음" }}</dd>
          </div>
          <div>
            <dt>이번 주 기록</dt>
            <dd>
              {{ user.weekDays }}일
              <span v-if="weekStats.goalMet" class="admin-goal-met">달성</span>
              <span v-else-if="weekStats.main > 0" class="admin-goal-pending">
                {{ formatHmFromMinutes(weekStats.main) }}
              </span>
            </dd>
          </div>
          <div>
            <dt>전체 기록</dt>
            <dd>{{ user.totalRecords }}건</dd>
          </div>
        </dl>

        <p v-if="error" class="admin-error">{{ error }}</p>

        <div class="admin-detail-actions">
          <button type="button" class="button button-soft button-sm" @click="close">취소</button>
          <button type="submit" class="button button-primary button-sm" :disabled="saving">
            {{ saving ? "저장 중…" : "저장" }}
          </button>
        </div>
      </form>
    </aside>
  </template>
</template>
