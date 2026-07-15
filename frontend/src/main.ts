import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { registerSW } from "virtual:pwa-register";
import { showApiError } from "./utils/apiError";
import { bootLog } from "./utils/bootLog";
import "element-plus/es/components/message/style/css";
import "./styles/main.css";

bootLog("main.start", { mode: import.meta.env.MODE, prod: import.meta.env.PROD });

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
  bootLog("pwa.register", { when: "prod" });
} else {
  // 개발 중에도 예전 prod SW가 localhost를 가로채 /api 프록시를 깨뜨릴 수 있음
  void navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((reg) => {
      void reg.unregister();
    });
    if (regs.length > 0) {
      bootLog("pwa.unregister", { count: regs.length });
    }
  });
  bootLog("pwa.skip", { when: "dev" });
}

const app = createApp(App);
app.config.errorHandler = (error) => {
  console.error("[boot] vue.error", error);
  showApiError(error);
};
app.use(createPinia());
app.use(router);
app.mount("#app");
bootLog("main.mounted");
