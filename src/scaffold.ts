import path from "node:path";
import fs from "fs-extra";
import type { Framework } from "./types.js";

export interface ProjectScaffoldOptions {
  outputDir: string;
  framework: Framework;
  buildTool: "vite" | "nextjs";
  typescript: boolean;
}

export interface ScaffoldResult {
  files: string[];
  outputDir: string;
}

/**
 * Generates a complete project scaffold including:
 * - package.json with dependencies
 * - Build tool config (vite.config.ts or next.config.js)
 * - tsconfig.json (if TypeScript)
 * - .env, .env.example, .gitignore
 * - src/ entry point and index.html (for Vite)
 */
export async function scaffoldProject(options: ProjectScaffoldOptions): Promise<ScaffoldResult> {
  const { outputDir, framework, buildTool, typescript } = options;
  const writtenFiles: string[] = [];

  const templates = getProjectTemplates(framework, buildTool, typescript);

  for (const template of templates) {
    const absolutePath = path.resolve(outputDir, template.path);
    await fs.ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, template.content, "utf-8");
    writtenFiles.push(absolutePath);
  }

  return { files: writtenFiles, outputDir: path.resolve(outputDir) };
}

function getProjectTemplates(
  framework: Framework,
  buildTool: string,
  typescript: boolean,
): Array<{ path: string; content: string }> {
  const ext = typescript ? "ts" : "js";
  const mainFile = framework.id === "react" ? `main.${typescript ? "tsx" : "jsx"}` : `main.${ext}`;

  const templates: Array<{ path: string; content: string }> = [
    // ── package.json ─────────────────────────────────────────────────────
    {
      path: "package.json",
      content: generatePackageJson(framework, buildTool, typescript),
    },

    // ── Core: Navigation ───────────────────────────────────────────────────
    {
      path: `src/core/navigation/Router.${framework.id === "react" ? "tsx" : framework.id === "vue" ? "vue" : framework.id === "svelte" ? "svelte" : "ts"}`,
      content: generateNavigation(framework),
    },

    // ── Core: Network ──────────────────────────────────────────────────────
    {
      path: `src/core/network/apiClient.ts`,
      content: generateNetworkClient(framework),
    },

    // ── .gitignore ───────────────────────────────────────────────────────
    {
      path: ".gitignore",
      content: generateGitignore(framework, buildTool),
    },

    // ── .env ─────────────────────────────────────────────────────────────
    {
      path: ".env",
      content: `VITE_API_URL=http://localhost:3000\n`,
    },

    // ── .env.example ─────────────────────────────────────────────────────
    {
      path: ".env.example",
      content: `VITE_API_URL=http://localhost:3000\n`,
    },

    // ── Main entry ───────────────────────────────────────────────────────
    {
      path: `src/${mainFile}`,
      content: generateMainEntry(framework),
    },

    // ── App root component ───────────────────────────────────────────────
    {
      path: `src/App.${framework.fileExtension}`,
      content: generateAppComponent(framework),
    },
  ];

  // ── TypeScript config ────────────────────────────────────────────────
  if (typescript) {
    templates.push({
      path: "tsconfig.json",
      content: generateTsConfig(framework),
    });
    templates.push({
      path: "tsconfig.node.json",
      content: `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
`,
    });
    templates.push({
      path: `src/vite-env.d.ts`,
      content: `/// <reference types="vite/client" />
`,
    });
  }

  // ── Build tool config ────────────────────────────────────────────────
  if (buildTool === "vite") {
    templates.push({
      path: `vite.config.${typescript ? "ts" : "js"}`,
      content: generateViteConfig(framework, typescript),
    });
    templates.push({
      path: "index.html",
      content: generateIndexHtml(framework),
    });
  } else if (buildTool === "nextjs") {
    templates.push({
      path: "next.config.mjs",
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
`,
    });
  }

  return templates;
}

function generatePackageJson(framework: Framework, buildTool: string, typescript: boolean): string {
  const deps: Record<string, string> = {};
  const devDeps: Record<string, string> = {};

  switch (framework.id) {
    case "react":
      deps["react"] = "^18.2.0";
      deps["react-dom"] = "^18.2.0";
      deps["react-router-dom"] = "^6.22.0";
      if (buildTool === "vite") {
        devDeps["@vitejs/plugin-react"] = "^4.2.0";
        devDeps["vite"] = "^5.1.0";
      } else {
        deps["next"] = "^14.1.0";
      }
      break;
    case "vue":
      deps["vue"] = "^3.4.0";
      deps["vue-router"] = "^4.3.0";
      if (buildTool === "vite") {
        devDeps["@vitejs/plugin-vue"] = "^5.0.0";
        devDeps["vite"] = "^5.1.0";
      }
      break;
    case "svelte":
      deps["svelte"] = "^4.2.0";
      if (buildTool === "vite") {
        devDeps["@sveltejs/vite-plugin-svelte"] = "^3.0.0";
        devDeps["vite"] = "^5.1.0";
      }
      break;
    case "angular":
      deps["@angular/core"] = "^17.2.0";
      deps["@angular/common"] = "^17.2.0";
      deps["@angular/router"] = "^17.2.0";
      deps["rxjs"] = "^7.8.0";
      deps["zone.js"] = "~0.14.0";
      devDeps["@angular-devkit/build-angular"] = "^17.2.0";
      devDeps["@angular/cli"] = "^17.2.0";
      break;
  }

  if (typescript) {
    devDeps["typescript"] = "^5.3.0";
  }

  const scripts: Record<string, string> = {};
  if (buildTool === "vite") {
    scripts["dev"] = "vite";
    scripts["build"] = "tsc -b && vite build";
    scripts["preview"] = "vite preview";
  } else if (buildTool === "nextjs") {
    scripts["dev"] = "next dev";
    scripts["build"] = "next build";
    scripts["start"] = "next start";
  }

  return JSON.stringify(
    {
      name: "my-app",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts,
      dependencies: Object.keys(deps).length ? deps : undefined,
      devDependencies: Object.keys(devDeps).length ? devDeps : undefined,
    },
    null,
    2,
  ) + "\n";
}

function generateNavigation(framework: Framework): string {
  if (framework.id === "react") {
    return `import { BrowserRouter, Routes, Route } from "react-router-dom";

export function Router(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <div style={{ textAlign: "center", marginTop: "20vh" }}>
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg"
                alt="React logo"
                width="80"
                height="80"
              />
              <h1>Welcome to <strong>framearch</strong></h1>
              <p style={{ color: "#6b7280" }}>
                Scaffold any feature, your way
              </p>
              <p style={{ marginTop: "24px", color: "#8b5cf6" }}>
                Powered by React + Vite + TypeScript
              </p>
            </div>
          }
        />
        {/* Feature routes will be added here */}
      </Routes>
    </BrowserRouter>
  );
}
`;
  }
  if (framework.id === "vue") {
    return `<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<template>
  <RouterView />
</template>
`;
  }
  return `// Navigation router setup for ${framework.name}\n`;
}

function generateNetworkClient(_framework: Framework): string {
  return `/**
 * Shared API client used across all features.
 * Configure base URL, interceptors, and auth headers here.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: \`Bearer \${token}\` } : {};
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
    method,
    headers: { "Content-Type": "application/json", ...getAuthHeader(), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message ?? \`HTTP \${response.status}\`);
  }

  return response.json() as Promise<T>;
}

export const http = {
  get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: "GET" });
  },
  post<T>(endpoint: string, body: unknown): Promise<T> {
    return request<T>(endpoint, { method: "POST", body });
  },
  put<T>(endpoint: string, body: unknown): Promise<T> {
    return request<T>(endpoint, { method: "PUT", body });
  },
  delete(endpoint: string): Promise<void> {
    return request(endpoint, { method: "DELETE" }) as Promise<void>;
  },
};
`;
}

function generateGitignore(_framework: Framework, buildTool: string): string {
  return `# Dependencies
node_modules/

# Build outputs
${buildTool === "nextjs" ? ".next/" : "dist/"}

# Environment files
.env
.env.local
.env.*.local
!.env.example

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
`;
}

function generateTsConfig(framework: Framework): string {
  const paths: Record<string, string[]> = {};

  if (framework.id === "react") {
    paths["@/*"] = ["./src/*"];
  }

  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        isolatedModules: true,
        moduleDetection: "force",
        noEmit: true,
        jsx: framework.id === "react" ? "react-jsx" : undefined,
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        paths: Object.keys(paths).length ? paths : undefined,
      },
      include: ["src"],
    },
    null,
    2,
  ) + "\n";
}

function generateViteConfig(framework: Framework, _typescript: boolean): string {
  let plugin = "";
  let plugins: string[] = [];

  switch (framework.id) {
    case "react":
      plugin = `import react from '@vitejs/plugin-react'`;
      plugins = ["react()"];
      break;
    case "vue":
      plugin = `import vue from '@vitejs/plugin-vue'`;
      plugins = ["vue()"];
      break;
    case "svelte":
      plugin = `import { svelte } from '@sveltejs/vite-plugin-svelte'`;
      plugins = ["svelte()"];
      break;
  }

  return `import { defineConfig } from 'vite'
${plugin}

export default defineConfig({
  plugins: [${plugins.join(", ")}],
})
`;
}

function generateIndexHtml(framework: Framework): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${framework.fileExtension === "tsx" ? "tsx" : "ts"}"></script>
  </body>
</html>
`;
}

function generateMainEntry(framework: Framework): string {
  switch (framework.id) {
    case "react":
      return `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;
    case "vue":
      return `import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#root");
`;
    case "svelte":
      return `import App from "./App.svelte";

const app = new App({
  target: document.getElementById("root")!,
});

export default app;
`;
    case "angular":
      return `// Angular bootstrap is handled by angular.json and main.ts
// This is a placeholder
`;
    default:
      return "";
  }
}

function generateAppComponent(framework: Framework): string {
  if (framework.id === "react") {
    return `import { Router } from "./core/navigation/Router";

function App(): JSX.Element {
  return <Router />;
}

export default App;
`;
  }

  if (framework.id === "vue") {
    return `<script setup lang="ts">
</script>

<template>
  <h1>Welcome</h1>
</template>
`;
  }

  if (framework.id === "svelte") {
    return `<h1>Welcome</h1>
`;
  }

  return `// TODO: Create your app component\n`;
}
