import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// localhost suffit pour Web MIDI + getUserMedia (contexte sécurisé).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: "localhost", port: 5173 },
});
