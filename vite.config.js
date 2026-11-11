import { defineConfig } from "vite";

// En développement, /api est relayé vers le serveur maison (npm start, port 8420).
export default defineConfig({
  server: {
    proxy: { "/api": "http://localhost:8420" },
  },
});
