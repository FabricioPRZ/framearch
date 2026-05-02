import fs from "fs-extra";
import path from "node:path";
import type { Framework } from "./types.js";
import { FRAMEWORKS } from "./frameworks/index.js";

export interface DetectedProject {
  framework: Framework;
  packagePath: string;
  hasTypeScript: boolean;
  buildTool: string;
}

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

  for (const { id, deps } of frameworkMap) {
    if (deps.some((d) => depNames.includes(d))) {
      const framework = FRAMEWORKS.find((f) => f.id === id)!;

      return {
        framework,
        packagePath,
        hasTypeScript: depNames.includes("typescript"),
        buildTool: detectBuildTool(depNames),
      };
    }
  }

  return null;
}

function detectBuildTool(depNames: string[]): string {
  if (depNames.includes("next")) return "nextjs";
  if (depNames.includes("@sveltejs/kit")) return "sveltekit";
  if (depNames.includes("@angular/cli")) return "angular-cli";
  if (depNames.includes("vite")) return "vite";
  if (depNames.includes("react-scripts")) return "cra";
  return "unknown";
}
