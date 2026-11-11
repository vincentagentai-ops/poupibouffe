import { defineConfig } from "vite";

// En développement, /api et /photos sont relayés vers le serveur maison (npm start, port 8420).
export default defineConfig({
  server: {
    proxy: { "/api": "http://localhost:8420", "/photos": "http://localhost:8420" },
  },
});
