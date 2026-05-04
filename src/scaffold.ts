import path from "node:path";
import fs from "fs-extra";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Framework } from "./types.js";

const execAsync = promisify(exec);

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

export async function scaffoldProject(options: ProjectScaffoldOptions): Promise<ScaffoldResult> {
  const { outputDir, framework, buildTool, typescript } = options;

  // Angular usa ng new, no Vite
  if (framework.id === "angular") {
    return scaffoldAngularProject(outputDir, typescript);
  }

  const writtenFiles: string[] = [];
  const templates = getProjectTemplates(framework, buildTool, typescript);

  for (const template of templates) {
    const absolutePath = path.resolve(outputDir, template.path);
    await fs.ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, template.content, "utf-8");
    writtenFiles.push(absolutePath);
  }

  return {
    files: writtenFiles,
    outputDir: path.resolve(outputDir),
  };
}

async function scaffoldAngularProject(outputDir: string, typescript: boolean): Promise<ScaffoldResult> {
  const projectName = path.basename(path.resolve(outputDir));
  const parentDir = path.dirname(path.resolve(outputDir));

  // ng new genera la carpeta del proyecto automáticamente
  const flags = [
    `--directory=${path.basename(outputDir)}`,
    "--routing=true",
    "--style=css",
    "--standalone=true",
    `--skip-git=true`,
    typescript ? "--strict=true" : "--strict=false",
    "--skip-install=false",
  ].join(" ");

  await execAsync(`npx @angular/cli@latest new ${projectName} ${flags}`, {
    cwd: parentDir,
  });

  // Listar los archivos generados por ng new
  const allFiles: string[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") {
        await walk(full);
      } else if (entry.isFile()) {
        allFiles.push(full);
      }
    }
  }
  await walk(path.resolve(outputDir));

  return {
    files: allFiles,
    outputDir: path.resolve(outputDir),
  };
}

function getProjectTemplates(
  framework: Framework,
  buildTool: string,
  typescript: boolean,
): Array<{ path: string; content: string }> {
  const ext = typescript ? "ts" : "js";
  const mainFile =
    framework.id === "react"
      ? `main.${typescript ? "tsx" : "jsx"}`
      : `main.${ext}`;

  const templates: Array<{ path: string; content: string }> = [
    {
      path: "package.json",
      content: generatePackageJson(framework, buildTool, typescript),
    },
    {
      path: `src/core/navigation/Router.${
        framework.id === "react" ? "tsx" : framework.id === "vue" ? "vue" : framework.id === "svelte" ? "svelte" : "ts"
      }`,
      content: generateNavigation(framework),
    },
    {
      path: "src/core/network/apiClient.ts",
      content: generateNetworkClient(framework),
    },
    { path: ".gitignore", content: generateGitignore(framework, buildTool) },
    { path: ".env", content: `VITE_API_URL=http://localhost:3000\n` },
    { path: ".env.example", content: `VITE_API_URL=http://localhost:3000\n` },
    { path: `src/${mainFile}`, content: generateMainEntry(framework) },
    { path: `src/App.${framework.fileExtension}`, content: generateAppComponent(framework) },
  ];

  if (typescript) {
    templates.push({ path: "tsconfig.json", content: generateTsConfig(framework) });
    templates.push({
      path: "tsconfig.node.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            composite: true,
            skipLibCheck: true,
            module: "ESNext",
            moduleResolution: "bundler",
            allowSyntheticDefaultImports: true,
          },
          include: ["vite.config.ts"],
        },
        null,
        2,
      ),
    });
    templates.push({ path: "src/vite-env.d.ts", content: `/// <reference types="vite/client" />\n` });
  }

  if (buildTool === "vite") {
    templates.push({ path: `vite.config.${ext}`, content: generateViteConfig(framework, typescript) });
    templates.push({ path: "index.html", content: generateIndexHtml(framework) });
  } else if (buildTool === "nextjs") {
    templates.push({
      path: "next.config.mjs",
      content: `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nexport default nextConfig;\n`,
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
  }

  if (typescript) devDeps["typescript"] = "^5.3.0";

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
        <Route path="/" element={<div>Welcome</div>} />
        {/* Feature routes will be added here */}
      </Routes>
    </BrowserRouter>
  );
}
`;
  }
  return `// Navigation for ${framework.name}\n`;
}

function generateNetworkClient(_framework: Framework): string {
  return `export const http = {\n  get: async () => {},\n};\n`;
}

function generateGitignore(_framework: Framework, buildTool: string): string {
  return `node_modules\n${buildTool === "nextjs" ? ".next" : "dist"}\n.env\n`;
}

function generateTsConfig(_framework: Framework): string {
  return JSON.stringify({ compilerOptions: { target: "ES2020" } }, null, 2);
}

function generateViteConfig(framework: Framework, _typescript: boolean): string {
  if (framework.id === "react") {
    return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;
  }
  if (framework.id === "vue") {
    return `import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
});
`;
  }
  if (framework.id === "svelte") {
    return `import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
});
`;
  }
  return `import { defineConfig } from "vite";\n\nexport default defineConfig({});\n`;
}

function generateIndexHtml(framework: Framework): string {
  const rootId = "root";
  const scriptSrc =
    framework.id === "react"
      ? `src/main.tsx`
      : framework.id === "vue"
      ? `src/main.ts`
      : framework.id === "svelte"
      ? `src/main.ts`
      : `src/main.ts`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="${rootId}"></div>
    <script type="module" src="/${scriptSrc}"></script>
  </body>
</html>
`;
}

function generateMainEntry(framework: Framework): string {
  if (framework.id === "react") {
    return `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;
  }
  if (framework.id === "vue") {
    return `import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#root");
`;
  }
  if (framework.id === "svelte") {
    return `import App from "./App.svelte";

const app = new App({
  target: document.getElementById("root")!,
});

export default app;
`;
  }
  // Angular — ng new genera su propio main.ts, este es fallback
  return ``;
}

function generateAppComponent(framework: Framework): string {
  if (framework.id === "react") {
    return `function App() {
  return <h1>Welcome</h1>;
}

export default App;
`;
  }
  if (framework.id === "vue") {
    return `<template>
  <h1>Welcome</h1>
</template>
`;
  }
  if (framework.id === "svelte") {
    return `<h1>Welcome</h1>
`;
  }
  // Angular — ng new genera su propio app.component.ts
  return ``;
}