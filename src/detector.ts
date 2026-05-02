import fs from "fs-extra";
import path from "node:path";
import type { Framework } from "./types.js";
import { FRAMEWORKS } from "./frameworks/index.js";

export interface DetectedProject {
  framework: Framework;
  packagePath: string;
  /** Whether the project uses TypeScript */
  hasTypeScript: boolean;
  /** The build tool being used: "vite" | "nextjs" | "cra" | "angular-cli" | "sveltekit" | "unknown" */
  buildTool: string;
}

/**
 * Scans a directory for a package.json and tries to detect
 * which framework is already installed.
 */
export async function detectExistingProject(dir: string): Promise<DetectedProject | null> {
  const packagePath = path.resolve(dir, "package.json");
  const exists = await fs.pathExists(packagePath);
  if (!exists) return null;

  const pkg = await fs.readJson(packagePath);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const depNames = Object.keys(allDeps);

  const frameworkMap: Array<{ id: string; deps: string[] }> = [
    { id: "react", deps: ["react"] },
    { id: "vue", deps: ["vue"] },
    { id: "svelte", deps: ["svelte"] },
    { id: "angular", deps: ["@angular/core"] },
  ];

  let detected: DetectedProject | null = null;

  for (const { id, deps } of frameworkMap) {
    if (deps.some((d) => depNames.includes(d))) {
      const framework = FRAMEWORKS.find((f) => f.id === id)!;
      detected = {
        framework,
        packagePath,
        hasTypeScript: depNames.includes("typescript"),
        buildTool: detectBuildTool(depNames),
      };
      break;
    }
  }

  return detected;
}

function detectBuildTool(depNames: string[]): string {
  if (depNames.includes("next")) return "nextjs";
  if (depNames.includes("@sveltejs/kit")) return "sveltekit";
  if (depNames.includes("@angular/cli")) return "angular-cli";
  if (depNames.includes("vite")) return "vite";
  if (depNames.includes("react-scripts")) return "cra";
  return "unknown";
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

function generateNetworkClient(): string {
  return `export const http = {
  get: async () => {},
};`;
}

function generateGitignore(): string {
  return `node_modules
dist
.env
`;
}

function generateMainEntry(framework: Framework): string {
  if (framework.id === "react") {
    return `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
`;
  }

  return ``;
}

function generateAppComponent(framework: Framework): string {
  if (framework.id === "react") {
    return `function App() {
  return <h1>Hello</h1>;
}

export default App;
`;
  }

  return ``;
}

function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
      },
    },
    null,
    2,
  );
}

function generateViteConfig(): string {
  return `import { defineConfig } from "vite";

export default defineConfig({});
`;
}

function generateIndexHtml(): string {
  return `<!DOCTYPE html>
<html>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}
