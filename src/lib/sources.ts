/* Bundles the exact source of this project via Vite's ?raw imports, so the
   "Download source" zip always matches what is actually running. */

import readmeIndexHtml from "../../index.html?raw";
import tsconfig from "../../tsconfig.json?raw";

import mainTsx from "../main.tsx?raw";
import indexCss from "../index.css?raw";
import appTsx from "../App.tsx?raw";
import viteEnv from "../vite-env.d.ts?raw";

import chatArea from "../components/ChatArea.tsx?raw";
import composer from "../components/Composer.tsx?raw";
import loadingScreen from "../components/LoadingScreen.tsx?raw";
import logo from "../components/Logo.tsx?raw";
import markdown from "../components/Markdown.tsx?raw";
import onboarding from "../components/Onboarding.tsx?raw";
import settingsModal from "../components/SettingsModal.tsx?raw";
import sidebar from "../components/Sidebar.tsx?raw";
import sourceModal from "../components/SourceModal.tsx?raw";

import engineTs from "./engine.ts?raw";
import lucaTs from "./luca.ts?raw";
import sourcesTs from "./sources.ts?raw";

const CLEAN_PACKAGE_JSON = `{
  "name": "luca-ai-ui",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "jszip": "^3.10.1",
    "lucide-react": "^0.294.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.7",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.1.7",
    "typescript": "^5.7.0",
    "vite": "^6.3.5"
  }
}
`;

/* Port 5173 on purpose — your existing server.js owns :3000. */
const CLEAN_VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
`;

const README = `# Luca AI — chat UI

React + Vite + Tailwind v4 front-end for the Luca AI backend (your existing
\`server.js\`). Monochrome design system with a restrained steel-blue accent,
onboarding flow, sessions, streaming chat with tool-call rounds, and a
built-in simulation that shows exactly how responses render when the
backend is not reachable.

## Quick start

\`\`\`bash
npm install
npm run dev        # UI at http://localhost:5173
node server.js     # your backend at http://localhost:3000
\`\`\`

Open http://localhost:5173 — the UI finds the backend automatically.

## Backend wiring

- \`src/lib/luca.ts → getBackendUrl()\` reads \`luca-settings.backendUrl\`
  from localStorage (same contract as the original project), strips
  trailing slashes, defaults to \`http://localhost:3000\`.
- \`src/lib/engine.ts → streamChat()\` POSTs \`{ modelTier, messages,
  stream: true, tools: true, userSettings }\` to \`/api/chat\` and parses
  the SSE stream (\`data: {"reasoning"|"content"|"tool_calls"}\` …
  \`data: [DONE]\`). Tool calls are executed against \`/api/tools/search\`
  and \`/api/tools/images\`, results fed back as \`role: "tool"\` (max 6
  iterations). Chat titles come from \`POST /api/name-chat\`.
- If the backend is unreachable, a local simulation streams sample
  replies through the identical pipeline so you can see exactly how real
  responses will look.

## Storage keys (unchanged from the original)

\`luca-settings\` · \`luca_tier\` · \`luca-sessions\` ·
\`luca-active-session\` · \`luca-onboarding\`

## Structure

\`\`\`
index.html            entry + pre-paint theme script
src/index.css         design tokens + motion library (Tailwind v4)
src/App.tsx           orchestration: sessions, streaming, reset
src/lib/luca.ts       types + storage contract + helpers
src/lib/engine.ts     SSE client + agent loop + simulation
src/components/       Sidebar · ChatArea · Composer · Markdown ·
                      Onboarding · LoadingScreen · SettingsModal ·
                      SourceModal · Logo
\`\`\`
`;

export interface SourceFile {
  path: string;
  content: string;
}

export const SOURCE_FILES: SourceFile[] = [
  { path: "README.md", content: README },
  { path: "package.json", content: CLEAN_PACKAGE_JSON },
  { path: "vite.config.js", content: CLEAN_VITE_CONFIG },
  { path: "tsconfig.json", content: tsconfig },
  { path: "index.html", content: readmeIndexHtml },
  { path: "src/main.tsx", content: mainTsx },
  { path: "src/index.css", content: indexCss },
  { path: "src/vite-env.d.ts", content: viteEnv },
  { path: "src/App.tsx", content: appTsx },
  { path: "src/lib/luca.ts", content: lucaTs },
  { path: "src/lib/engine.ts", content: engineTs },
  { path: "src/lib/sources.ts", content: sourcesTs },
  { path: "src/components/Sidebar.tsx", content: sidebar },
  { path: "src/components/ChatArea.tsx", content: chatArea },
  { path: "src/components/Composer.tsx", content: composer },
  { path: "src/components/Markdown.tsx", content: markdown },
  { path: "src/components/Onboarding.tsx", content: onboarding },
  { path: "src/components/LoadingScreen.tsx", content: loadingScreen },
  { path: "src/components/SettingsModal.tsx", content: settingsModal },
  { path: "src/components/SourceModal.tsx", content: sourceModal },
  { path: "src/components/Logo.tsx", content: logo },
];

export function sourceStats(): { files: number; bytes: number } {
  return {
    files: SOURCE_FILES.length,
    bytes: SOURCE_FILES.reduce((n, f) => n + f.content.length, 0),
  };
}

export function downloadTextFile(path: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = path.split("/").pop() || "file.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
