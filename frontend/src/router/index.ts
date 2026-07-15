import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import LoginView from "../views/LoginView.vue";
import SignupView from "../views/SignupView.vue";
import { bootLog } from "../utils/bootLog";

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
      component: () => import("../views/DashboardView.vue"),
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

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  bootLog("router.beforeEach", {
    to: to.fullPath,
    initialized: auth.initialized,
    hasUser: Boolean(auth.user)
  });

  if (!auth.initialized) {
    await auth.bootstrap();
    bootLog("router.bootstrap.awaited", {
      initialized: auth.initialized,
      hasUser: Boolean(auth.user)
    });
  }

  if (to.meta.requiresAuth && !auth.user) {
    bootLog("router.redirect.login", { to: to.fullPath });
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  if (to.meta.requiresAdmin && auth.user?.role !== "ADMIN") {
    bootLog("router.redirect.home", { reason: "not_admin", to: to.fullPath });
    return { path: "/" };
  }

  if (to.meta.guestOnly && auth.user) {
    bootLog("router.redirect.home", { reason: "already_logged_in", to: to.fullPath });
    return { path: "/" };
  }

  bootLog("router.allow", { to: to.fullPath });
  return true;
});

router.afterEach((to) => {
  bootLog("router.afterEach", { to: to.fullPath, name: to.name });
});

export default router;
