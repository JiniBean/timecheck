import { defineConfig, type ProxyOptions } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

function isNgrokHost(host: string | undefined): boolean {
  if (!host) {
    return false;
  }
  return host.includes("ngrok");
}

function createApiProxy(): ProxyOptions {
  return {
    target: "http://localhost:2406",
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq, req) => {
        const host = req.headers.host;
        if (isNgrokHost(host)) {
          proxyReq.setHeader("X-Forwarded-Proto", "https");
          proxyReq.setHeader("X-Forwarded-Host", host ?? "");
        }
      });
      proxy.on("proxyRes", (proxyRes, req) => {
        if (!isNgrokHost(req.headers.host)) {
          return;
        }
        const raw = proxyRes.headers["set-cookie"];
        if (!raw) {
          return;
        }
        const cookies = Array.isArray(raw) ? raw : [raw];
        proxyRes.headers["set-cookie"] = cookies.map((cookie) => {
          const normalized = cookie.replace(/; ?secure/gi, "").replace(/; ?samesite=[^;]+/gi, "");
          return `${normalized}; Secure; SameSite=Lax`;
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-192x192.png", "pwa-512x512.png", "pwa-512x512-maskable.png", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "TimeCheck",
        short_name: "TimeCheck",
        description: "근무시간 계산기",
        theme_color: "#3b82f6",
        background_color: "#f4f6fb",
        display: "standalone",
        orientation: "portrait",
        lang: "ko",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "pwa-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly"
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    proxy: {
      "/api": createApiProxy()
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
