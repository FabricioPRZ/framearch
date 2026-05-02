import path from "node:path";
import fs from "fs-extra";

export interface FeatureRouteConfig {
  featureName: string;
  routes: { path: string; componentName: string; importPath: string }[];
}

/**
 * Injects feature routes into the React Router file.
 * Modifies src/core/navigation/Router.tsx in place.
 */
export async function injectReactFeatureRoutes(
  outputDir: string,
  config: FeatureRouteConfig,
): Promise<void> {
  const routerPath = path.resolve(outputDir, "src/core/navigation/Router.tsx");
  const exists = await fs.pathExists(routerPath);
  if (!exists) return;

  let content = await fs.readFile(routerPath, "utf-8");

  const imports = config.routes
    .map((r) => `import { ${r.componentName} } from "${r.importPath}";`)
    .join("\n");

  const importBlock = `\n${imports}\n`;
  content = content.replace(/(import { BrowserRouter)/, `${importBlock}$1`);

  content = content.replace(
    /(\s*){\/\* Feature routes will be added here \*\/}/,
    (_, indent: string) => {
      const indentedRoutes = config.routes
        .map((r) => `${indent}<Route path="${r.path}" element={<${r.componentName} />} />`)
        .join("\n");
      return `${indentedRoutes}\n${indent}{/* Feature routes will be added here */}`;
    },
  );

  await fs.writeFile(routerPath, content, "utf-8");
}
