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
export async function scaffoldProject(
  options: ProjectScaffoldOptions,
): Promise<ScaffoldResult> {
  const { outputDir, framework, buildTool, typescript } = options;
  const writtenFiles: string[] = [];

  const templates = getProjectTemplates(
    framework,
    buildTool,
    typescript,
  );

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

function getProjectTemplates(
  framework: Framework,
  buildTool: string,
  typescript: boolean,
): Array<{
  path: string;
  content: string;
}> {
  const ext = typescript ? "ts" : "js";
  const mainFile =
    framework.id === "react"
      ? `main.${typescript ? "tsx" : "jsx"}`
      : `main.${ext}`;

  const templates: Array<{
    path: string;
    content: string;
  }> = [
    {
      path: "package.json",
      content: generatePackageJson(
        framework,
        buildTool,
        typescript,
      ),
    },
    {
      path: `src/core/navigation/Router.${
        framework.id === "react"
          ? "tsx"
          : framework.id === "vue"
          ? "vue"
          : framework.id === "svelte"
          ? "svelte"
          : "ts"
      }`,
      content: generateNavigation(framework),
    },
    {
      path: "src/core/network/apiClient.ts",
      content: generateNetworkClient(framework),
    },
    {
      path: ".gitignore",
      content: generateGitignore(framework, buildTool),
    },
    {
      path: ".env",
      content: `VITE_API_URL=http://localhost:3000\n`,
    },
    {
      path: ".env.example",
      content: `VITE_API_URL=http://localhost:3000\n`,
    },
    {
      path: `src/${mainFile}`,
      content: generateMainEntry(framework),
    },
    {
      path: `src/App.${framework.fileExtension}`,
      content: generateAppComponent(framework),
    },
  ];

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
      path: "src/vite-env.d.ts",
      content: `/// <reference types="vite/client" />
`,
    });
  }

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

function generatePackageJson(
  framework: Framework,
  buildTool: string,
  typescript: boolean,
): string {
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

  return (
    JSON.stringify(
      {
        name: "my-app",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts,
        dependencies: Object.keys(deps).length
          ? deps
          : undefined,
        devDependencies: Object.keys(devDeps).length
          ? devDeps
          : undefined,
      },
      null,
      2,
    ) + "\n"
  );
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
  return `export const http = {
  get: async () => {},
};`;
}

function generateGitignore(
  _framework: Framework,
  buildTool: string,
): string {
  return `node_modules
${buildTool === "nextjs" ? ".next" : "dist"}
.env
`;
}

function generateTsConfig(_framework: Framework): string {
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

function generateViteConfig(
  _framework: Framework,
  _typescript: boolean,
): string {
  return `import { defineConfig } from "vite";

export default defineConfig({});
`;
}

function generateIndexHtml(_framework: Framework): string {
  return `<!DOCTYPE html>
<html>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}
