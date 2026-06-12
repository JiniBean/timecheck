import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import App from "./App.vue";
import router from "./router";
import { showApiError } from "./utils/apiError";
import "./styles/main.css";

const app = createApp(App);
app.config.errorHandler = (error) => {
  console.error(error);
  showApiError(error);
};
app.use(createPinia());
app.use(router);
app.use(ElementPlus);
app.mount("#app");
