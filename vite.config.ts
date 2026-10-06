import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * No `npm run dev`, faz uma visita automática à página inicial assim que o servidor liga.
 * Isso conecta no Neon e cria as tabelas na hora (você vê o resultado no terminal),
 * sem precisar abrir o navegador primeiro.
 */
function warmUpDatabase(): Plugin {
  return {
    name: "aquecer-banco",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        setTimeout(() => {
          const url = server.resolvedUrls?.local[0];
          if (url) fetch(url).catch(() => {});
        }, 800);
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    warmUpDatabase(),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Usa src/server.ts como entrada do servidor (tratamento de erros de SSR).
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // O Nitro só entra no build. Por padrão gera saída para Cloudflare;
    // para outro destino, rode o build com NITRO_PRESET=<preset> (ex.: vercel, node-server).
    ...(command === "build" ? [nitro({ defaultPreset: "cloudflare-module" })] : []),
    react(),
  ],
  css: { transformer: "lightningcss" },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  server: { port: 8080 },
}));
