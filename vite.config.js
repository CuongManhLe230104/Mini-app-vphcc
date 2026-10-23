import { defineConfig } from "vite";
import zaloMiniApp from "zmp-vite-plugin";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default () => {
  return defineConfig({
    root: "./src",
    envDir: process.cwd(),
    base: "",
    plugins: [zaloMiniApp(), react()],
    server: {
      proxy: {
        "^/api": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
      },
    },
    build: {
      assetsInlineLimit: 0,
    },
  });
};
