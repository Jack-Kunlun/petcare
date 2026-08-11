import { createSSRApp } from "vue";
import App from "./App.vue";
import "uno.css";

export function createApp() {
  return { app: createSSRApp(App) };
}
