import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3600,
    // Real-API mode: /v1 is proxied so the API's HttpOnly session cookies stay
    // same-origin — without this the browser rejects them and every request
    // after login is unauthenticated.
    // Same default as always; overridable so the app can run in a container,
    // where localhost is the container rather than the API host.
    proxy: { "/v1": { target: process.env.VITE_PROXY_TARGET || "http://localhost:3000", changeOrigin: true } },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query-vendor": ["@tanstack/react-query", "axios"],
          "radix-vendor": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-aspect-ratio",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-label",
            "@radix-ui/react-menubar",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip",
          ],
          "charts-vendor": ["recharts", "d3-geo", "react-simple-maps"],
          "pdf-vendor": ["@react-pdf/renderer", "jspdf", "html2canvas"],
          "motion-vendor": ["framer-motion"],
          "form-vendor": [
            "react-hook-form",
            "formik",
            "yup",
            "zod",
            "@hookform/resolvers",
          ],
          "date-vendor": ["moment", "date-fns", "react-day-picker"],
          "phone-vendor": [
            "libphonenumber-js",
            "react-phone-input-2",
            "react-phone-number-input",
          ],
          "select-vendor": ["react-select", "cmdk"],
          "utils-vendor": ["lodash"],
        },
      },
    },
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
