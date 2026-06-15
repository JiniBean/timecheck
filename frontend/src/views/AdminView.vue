<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import AdminKpiCards from "../components/admin/AdminKpiCards.vue";
import UserDetailPanel from "../components/admin/UserDetailPanel.vue";
import logoutIcon from "../assets/icons/logout.svg";
import * as adminApi from "../api/admin";
import { useAuthStore } from "../stores/auth";
import type { Overview, Period, UserDetail, UserForm } from "../types/admin";
import { adminStatusLabel } from "../utils/admin";
import { weekSummary } from "../utils/main";
import { formatHmFromMinutes } from "../utils/time";

const router = useRouter();
const authStore = useAuthStore();

const tab = ref<"overview" | "users">("overview");
const period = ref<Period>("week");
const overview = ref<Overview | null>(null);
const users = ref<UserDetail[]>([]);
const weekStart = ref("");
const weekEnd = ref("");
const selectedUser = ref<UserDetail | null>(null);
const statusFilter = ref("");
const departmentFilter = ref("");
const loadingOverview = ref(false);
const loadingUsers = ref(false);
const savingUser = ref(false);
const error = ref("");
const userError = ref("");
const saveToast = ref(false);

let saveToastTimer: number | null = null;

const departments = computed(() => {
  const set = new Set<string>();
  for (const user of users.value) {
    if (user.department) {
      set.add(user.department);
    }
  }
  return [...set].sort();
});

const weeklyGoalStats = computed(() => {
  if (!weekStart.value || !weekEnd.value || users.value.length === 0) {
    return { metUsers: 0, rate: 0 };
  }

  let metUsers = 0;
  let activeInWeek = 0;

  for (const user of users.value) {
    if (user.weekDays === 0) {
      continue;
    }
    activeInWeek += 1;
    const stats = weekSummary(user.weekRecords, weekStart.value, weekEnd.value, user.userId);
    if (stats.goalMet) {
      metUsers += 1;
    }
  }

  return {
    metUsers,
    rate: activeInWeek === 0 ? 0 : metUsers / activeInWeek
  };
});

function weekStats(user: UserDetail) {
  if (!weekStart.value || !weekEnd.value) {
    return { main: 0, base: 0, goalMet: false };
  }
  return weekSummary(user.weekRecords, weekStart.value, weekEnd.value, user.userId);
}

function showSaveToast() {
  saveToast.value = true;
  if (saveToastTimer !== null) {
    window.clearTimeout(saveToastTimer);
  }
  saveToastTimer = window.setTimeout(() => {
    saveToast.value = false;
    saveToastTimer = null;
  }, 2000);
}

async function loadOverview() {
  loadingOverview.value = true;
  error.value = "";
  try {
    overview.value = await adminApi.fetchOverview(period.value);
  } catch (e) {
    error.value = resolveMessage(e);
  } finally {
    loadingOverview.value = false;
  }
}

async function loadUsers() {
  loadingUsers.value = true;
  error.value = "";
  try {
    const data = await adminApi.fetchUsers({
      department: departmentFilter.value || undefined,
      status: statusFilter.value || undefined
    });
    weekStart.value = data.weekStart;
    weekEnd.value = data.weekEnd;
    users.value = data.users;
  } catch (e) {
    error.value = resolveMessage(e);
  } finally {
    loadingUsers.value = false;
  }
}

async function selectUser(user: UserDetail) {
  userError.value = "";
  try {
    selectedUser.value = await adminApi.fetchUser(user.userId);
  } catch (e) {
    userError.value = resolveMessage(e);
  }
}

async function saveUser(form: UserForm) {
  if (!selectedUser.value) {
    return;
  }
  savingUser.value = true;
  userError.value = "";
  try {
    const updated = await adminApi.updateUser(selectedUser.value.userId, form);
    selectedUser.value = updated;
    await loadUsers();
    if (tab.value === "overview") {
      await loadOverview();
    }
    showSaveToast();
  } catch (e) {
    userError.value = resolveMessage(e);
  } finally {
    savingUser.value = false;
  }
}

function resolveMessage(errorValue: unknown): string {
  if (typeof errorValue === "object" && errorValue !== null && "response" in errorValue) {
    const response = (errorValue as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }
  return "요청을 처리하지 못했습니다.";
}

async function handleLogout() {
  await authStore.logout();
  await router.replace("/login");
}

watch(period, () => {
  if (tab.value === "overview") {
    loadOverview();
  }
});

watch(tab, (value) => {
  if (value === "overview" && !overview.value) {
    loadOverview();
  }
  if (value === "users" && users.value.length === 0) {
    loadUsers();
  }
});

onMounted(() => {
  loadOverview();
  loadUsers();
});

onBeforeUnmount(() => {
  if (saveToastTimer !== null) {
    window.clearTimeout(saveToastTimer);
  }
});
</script>

<template>
  <main class="admin-page">
    <header class="admin-header">
      <div class="admin-header-main">
        <router-link to="/" class="admin-back-link">← 근무 대시보드</router-link>
        <h1 class="admin-title">관리</h1>
      </div>
      <div class="admin-header-actions">
        <nav class="admin-tabs" aria-label="관리 메뉴">
          <button
            type="button"
            class="admin-tab"
            :class="{ 'admin-tab--active': tab === 'overview' }"
            @click="tab = 'overview'"
          >
            개요
          </button>
          <button
            type="button"
            class="admin-tab"
            :class="{ 'admin-tab--active': tab === 'users' }"
            @click="tab = 'users'"
          >
            사용자
          </button>
        </nav>
        <div class="admin-user-bar">
          <span class="dashboard-user-badge">{{ authStore.user?.name }}</span>
          <button type="button" class="dashboard-logout-btn" aria-label="로그아웃" @click="handleLogout">
            <img :src="logoutIcon" alt="" class="dashboard-logout-icon" />
          </button>
        </div>
      </div>
    </header>

    <Transition name="toast-fade">
      <p v-if="saveToast" class="admin-toast" role="status">저장되었습니다</p>
    </Transition>

    <p v-if="error" class="admin-error admin-page-error">{{ error }}</p>

    <section v-if="tab === 'overview'" class="admin-section">
      <div class="admin-toolbar">
        <label class="admin-period-label">
          기간
          <select v-model="period" class="select-input admin-toolbar-select">
            <option value="week">이번 주</option>
            <option value="month">이번 달</option>
            <option value="all">전체</option>
          </select>
        </label>
      </div>
      <AdminKpiCards
        :overview="overview"
        :loading="loadingOverview || loadingUsers"
        :period="period"
        :weekly-goal-met-users="weeklyGoalStats.metUsers"
        :weekly-goal-rate="weeklyGoalStats.rate"
      />
    </section>

    <section v-else class="admin-section admin-users-section">
      <div class="admin-toolbar">
        <label class="admin-period-label">
          부서
          <select v-model="departmentFilter" class="select-input admin-toolbar-select" @change="loadUsers">
            <option value="">전체</option>
            <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
          </select>
        </label>
        <label class="admin-period-label">
          상태
          <select v-model="statusFilter" class="select-input admin-toolbar-select" @change="loadUsers">
            <option value="">전체</option>
            <option value="active">활성</option>
            <option value="inactive">미사용</option>
            <option value="new">신규</option>
          </select>
        </label>
      </div>

      <div class="admin-users-layout">
        <div class="card admin-users-table-wrap">
          <table class="admin-users-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>부서</th>
                <th>상태</th>
                <th>이번 주</th>
                <th>역할</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loadingUsers">
                <td colspan="5">불러오는 중…</td>
              </tr>
              <tr v-else-if="users.length === 0">
                <td colspan="5">사용자가 없습니다.</td>
              </tr>
              <tr
                v-for="user in users"
                :key="user.userId"
                class="admin-users-row"
                :class="{ 'admin-users-row--selected': selectedUser?.userId === user.userId }"
                tabindex="0"
                :aria-selected="selectedUser?.userId === user.userId"
                @click="selectUser(user)"
                @keydown.enter="selectUser(user)"
              >
                <td>
                  <span class="admin-user-name">{{ user.name }}</span>
                </td>
                <td>{{ user.department ?? "—" }}</td>
                <td>
                  <span class="admin-status-badge" :data-status="user.status">
                    {{ adminStatusLabel(user.status) }}
                  </span>
                </td>
                <td>
                  {{ user.weekDays }}일
                  <span v-if="weekStats(user).goalMet" class="admin-goal-met">달성</span>
                  <span v-else-if="weekStats(user).main > 0" class="admin-goal-pending">
                    {{ formatHmFromMinutes(weekStats(user).main) }}
                  </span>
                </td>
                <td>{{ user.role === "ADMIN" ? "관리자" : "일반" }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <UserDetailPanel
          :user="selectedUser"
          :week-start="weekStart"
          :week-end="weekEnd"
          :saving="savingUser"
          :error="userError"
          @close="selectedUser = null"
          @save="saveUser"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}
</style>
