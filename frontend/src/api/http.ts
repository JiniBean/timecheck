import axios from "axios";

const http = axios.create({
  baseURL: "/api",
  timeout: 7000,
  withCredentials: true,
  headers: {
    "ngrok-skip-browser-warning": "true"
  }
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";

    if (status === 401 && !url.includes("/auth/me") && !url.includes("/auth/login") && !url.includes("/auth/signup")) {
      const { useAuthStore } = await import("../stores/auth");
      const router = (await import("../router")).default;
      const auth = useAuthStore();
      auth.clearUser();
      if (router.currentRoute.value.meta.requiresAuth) {
        await router.push({ path: "/login", query: { redirect: router.currentRoute.value.fullPath } });
      }
    }

    return Promise.reject(error);
  }
);

export default http;
