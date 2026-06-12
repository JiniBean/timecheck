import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import DashboardView from "../views/DashboardView.vue";
import LoginView from "../views/LoginView.vue";
import SignupView from "../views/SignupView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: LoginView,
      meta: { guestOnly: true }
    },
    {
      path: "/signup",
      name: "signup",
      component: SignupView,
      meta: { guestOnly: true }
    },
    {
      path: "/",
      name: "dashboard",
      component: DashboardView,
      meta: { requiresAuth: true }
    },
    {
      path: "/admin",
      name: "admin",
      component: () => import("../views/AdminView.vue"),
      meta: { requiresAuth: true, requiresAdmin: true }
    }
  ]
});

let bootstrapPromise: Promise<void> | null = null;

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.initialized) {
    if (!bootstrapPromise) {
      bootstrapPromise = auth.bootstrap();
    }
    await bootstrapPromise;
  }

  if (to.meta.requiresAuth && !auth.user) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  if (to.meta.requiresAdmin && auth.user?.role !== "ADMIN") {
    return { path: "/" };
  }

  if (to.meta.guestOnly && auth.user) {
    return { path: "/" };
  }

  return true;
});

export default router;
