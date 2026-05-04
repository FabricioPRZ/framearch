import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "fs-extra";

import { detectExistingProject } from "../src/detector.js";
import { injectReactFeatureRoutes } from "../src/featureRoutes.js";
import { scaffoldProject } from "../src/scaffold.js";
import { FRAMEWORKS } from "../src/frameworks/index.js";

const reactFramework = FRAMEWORKS.find((f) => f.id === "react")!;
const vueFramework = FRAMEWORKS.find((f) => f.id === "vue")!;
const svelteFramework = FRAMEWORKS.find((f) => f.id === "svelte")!;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function makeTmp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "framearch-cov-"));
}

async function writePackageJson(
  dir: string,
  deps: Record<string, string>,
  devDeps: Record<string, string> = {},
): Promise<void> {
  await fs.writeJson(path.join(dir, "package.json"), {
    name: "test-app",
    dependencies: deps,
    devDependencies: devDeps,
  });
}

// ─── detectExistingProject ───────────────────────────────────────────────────

describe("detectExistingProject", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTmp();
  });
  afterEach(async () => {
    await fs.remove(tmp);
  });

  it("returns null when package.json does not exist", async () => {
    const result = await detectExistingProject(tmp);
    expect(result).toBeNull();
  });

  it("detects a React project", async () => {
    await writePackageJson(tmp, { react: "^18.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result).not.toBeNull();
    expect(result!.framework.id).toBe("react");
  });

  it("detects a Vue project", async () => {
    await writePackageJson(tmp, { vue: "^3.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result!.framework.id).toBe("vue");
  });

  it("detects a Svelte project", async () => {
    await writePackageJson(tmp, { svelte: "^4.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result!.framework.id).toBe("svelte");
  });

  it("detects an Angular project", async () => {
    await writePackageJson(tmp, { "@angular/core": "^17.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result!.framework.id).toBe("angular");
  });

  it("returns null when no known framework dep is found", async () => {
    await writePackageJson(tmp, { lodash: "^4.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result).toBeNull();
  });

  it("detects TypeScript when typescript is in devDeps", async () => {
    await writePackageJson(tmp, { react: "^18.0.0" }, { typescript: "^5.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result!.hasTypeScript).toBe(true);
  });

  it("reports hasTypeScript false when typescript is absent", async () => {
    await writePackageJson(tmp, { react: "^18.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result!.hasTypeScript).toBe(false);
  });

  it("detects nextjs build tool", async () => {
    await writePackageJson(tmp, { react: "^18.0.0", next: "^14.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result!.buildTool).toBe("nextjs");
  });

  it("detects vite build tool", async () => {
    await writePackageJson(tmp, { react: "^18.0.0" }, { vite: "^5.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result!.buildTool).toBe("vite");
  });

  it("detects sveltekit build tool", async () => {
    await writePackageJson(tmp, { svelte: "^4.0.0" }, { "@sveltejs/kit": "^2.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result!.buildTool).toBe("sveltekit");
  });

  it("detects angular-cli build tool", async () => {
    await writePackageJson(tmp, { "@angular/core": "^17.0.0" }, { "@angular/cli": "^17.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result!.buildTool).toBe("angular-cli");
  });

  it("detects cra build tool", async () => {
    await writePackageJson(tmp, { react: "^18.0.0", "react-scripts": "^5.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result!.buildTool).toBe("cra");
  });

  it("falls back to unknown build tool", async () => {
    await writePackageJson(tmp, { react: "^18.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result!.buildTool).toBe("unknown");
  });

  it("returns the package path", async () => {
    await writePackageJson(tmp, { react: "^18.0.0" });
    const result = await detectExistingProject(tmp);
    expect(result!.packagePath).toBe(path.resolve(tmp, "package.json"));
  });
});

// ─── injectReactFeatureRoutes ────────────────────────────────────────────────

describe("injectReactFeatureRoutes", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTmp();
  });
  afterEach(async () => {
    await fs.remove(tmp);
  });

  const routerTemplate = `import { BrowserRouter, Routes, Route } from "react-router-dom";

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

  async function writeRouter(content: string = routerTemplate): Promise<void> {
    const routerDir = path.join(tmp, "src", "core", "navigation");
    await fs.ensureDir(routerDir);
    await fs.writeFile(path.join(routerDir, "Router.tsx"), content, "utf-8");
  }

  async function readRouter(): Promise<string> {
    return fs.readFile(path.join(tmp, "src", "core", "navigation", "Router.tsx"), "utf-8");
  }

  it("does nothing when Router.tsx does not exist", async () => {
    await expect(
      injectReactFeatureRoutes(tmp, {
        featureName: "auth",
        routes: [
          {
            path: "/auth/login",
            componentName: "LoginAuthView",
            importPath: "../../features/auth",
          },
        ],
      }),
    ).resolves.toBeUndefined();
  });

  it("injects import statements before the BrowserRouter import", async () => {
    await writeRouter();
    await injectReactFeatureRoutes(tmp, {
      featureName: "auth",
      routes: [
        { path: "/auth/login", componentName: "LoginAuthView", importPath: "../../features/auth" },
      ],
    });
    const content = await readRouter();
    expect(content).toContain('import { LoginAuthView } from "../../features/auth"');
  });

  it("injects Route elements into the router", async () => {
    await writeRouter();
    await injectReactFeatureRoutes(tmp, {
      featureName: "auth",
      routes: [
        { path: "/auth/login", componentName: "LoginAuthView", importPath: "../../features/auth" },
        {
          path: "/auth/register",
          componentName: "RegisterAuthView",
          importPath: "../../features/auth",
        },
      ],
    });
    const content = await readRouter();
    expect(content).toContain('<Route path="/auth/login"');
    expect(content).toContain('<Route path="/auth/register"');
  });

  it("preserves the placeholder comment after injection", async () => {
    await writeRouter();
    await injectReactFeatureRoutes(tmp, {
      featureName: "auth",
      routes: [
        { path: "/auth/login", componentName: "LoginAuthView", importPath: "../../features/auth" },
      ],
    });
    const content = await readRouter();
    expect(content).toContain("{/* Feature routes will be added here */}");
  });

  it("injects multiple routes in one call", async () => {
    await writeRouter();
    await injectReactFeatureRoutes(tmp, {
      featureName: "payments",
      routes: [
        {
          path: "/payments/list",
          componentName: "ListPaymentsView",
          importPath: "../../features/payments",
        },
        {
          path: "/payments/detail",
          componentName: "DetailPaymentsView",
          importPath: "../../features/payments",
        },
      ],
    });
    const content = await readRouter();
    expect(content).toContain("ListPaymentsView");
    expect(content).toContain("DetailPaymentsView");
  });
});

// ─── scaffoldProject ─────────────────────────────────────────────────────────

describe("scaffoldProject — React / Vue / Svelte (Vite)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTmp();
  });
  afterEach(async () => {
    await fs.remove(tmp);
  });

  it("creates files on disk for React + Vite + TypeScript", async () => {
    const result = await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    expect(result.files.length).toBeGreaterThan(0);
    for (const f of result.files) expect(await fs.pathExists(f)).toBe(true);
  });

  it("returns the resolved outputDir", async () => {
    const result = await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    expect(result.outputDir).toBe(path.resolve(tmp));
  });

  it("writes package.json with react dependency", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.name).toBe("my-app");
    expect(pkg.dependencies).toHaveProperty("react");
  });

  it("includes react-dom and react-router-dom for React", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.dependencies).toHaveProperty("react-dom");
    expect(pkg.dependencies).toHaveProperty("react-router-dom");
  });

  it("writes tsconfig.json when typescript is true", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    expect(await fs.pathExists(path.join(tmp, "tsconfig.json"))).toBe(true);
  });

  it("does not write tsconfig.json when typescript is false", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: false,
    });
    expect(await fs.pathExists(path.join(tmp, "tsconfig.json"))).toBe(false);
  });

  it("writes vite.config.ts and includes react plugin", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    expect(await fs.pathExists(path.join(tmp, "vite.config.ts"))).toBe(true);
    const content = await fs.readFile(path.join(tmp, "vite.config.ts"), "utf-8");
    expect(content).toContain("@vitejs/plugin-react");
  });

  it("writes vite.config.js without TypeScript", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: false,
    });
    expect(await fs.pathExists(path.join(tmp, "vite.config.js"))).toBe(true);
  });

  it("writes index.html with script tag for Vite", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    expect(await fs.pathExists(path.join(tmp, "index.html"))).toBe(true);
    const html = await fs.readFile(path.join(tmp, "index.html"), "utf-8");
    expect(html).toContain('<script type="module"');
  });

  it("writes next.config.mjs for Next.js build tool", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "nextjs",
      typescript: true,
    });
    expect(await fs.pathExists(path.join(tmp, "next.config.mjs"))).toBe(true);
  });

  it("does not write vite.config for Next.js", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "nextjs",
      typescript: true,
    });
    expect(await fs.pathExists(path.join(tmp, "vite.config.ts"))).toBe(false);
  });

  it("writes .gitignore", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    expect(await fs.pathExists(path.join(tmp, ".gitignore"))).toBe(true);
  });

  it("writes .env and .env.example", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    expect(await fs.pathExists(path.join(tmp, ".env"))).toBe(true);
    expect(await fs.pathExists(path.join(tmp, ".env.example"))).toBe(true);
  });

  it("scaffolds Vue + Vite with vue plugin in vite.config", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: vueFramework,
      buildTool: "vite",
      typescript: true,
    });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.dependencies).toHaveProperty("vue");
    const config = await fs.readFile(path.join(tmp, "vite.config.ts"), "utf-8");
    expect(config).toContain("@vitejs/plugin-vue");
  });

  it("scaffolds Svelte + Vite with svelte plugin in vite.config", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: svelteFramework,
      buildTool: "vite",
      typescript: true,
    });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.dependencies).toHaveProperty("svelte");
    const config = await fs.readFile(path.join(tmp, "vite.config.ts"), "utf-8");
    expect(config).toContain("@sveltejs/vite-plugin-svelte");
  });

  it("package.json scripts use vite for dev and build", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.scripts.dev).toBe("vite");
    expect(pkg.scripts.build).toContain("vite build");
  });

  it("package.json scripts use next for dev, build, start", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "nextjs",
      typescript: true,
    });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.scripts.dev).toBe("next dev");
    expect(pkg.scripts.start).toBe("next start");
  });

  it("writes main entry file", async () => {
    const result = await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    expect(result.files.some((f) => f.includes("main."))).toBe(true);
  });

  it("writes App component", async () => {
    const result = await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    expect(result.files.some((f) => f.includes("App."))).toBe(true);
  });

  it(".gitignore references dist for vite", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });
    const gitignore = await fs.readFile(path.join(tmp, ".gitignore"), "utf-8");
    expect(gitignore).toContain("dist");
  });

  it(".gitignore references .next for nextjs", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "nextjs",
      typescript: true,
    });
    const gitignore = await fs.readFile(path.join(tmp, ".gitignore"), "utf-8");
    expect(gitignore).toContain(".next");
  });

  it("Svelte main.ts mounts to #root", async () => {
    await scaffoldProject({
      outputDir: tmp,
      framework: svelteFramework,
      buildTool: "vite",
      typescript: true,
    });
    const main = await fs.readFile(path.join(tmp, "src", "main.ts"), "utf-8");
    expect(main).toContain('target: document.getElementById("root")');
  });
});

// ─── Angular usa ng new — se mockea execAsync ────────────────────────────────

describe("scaffoldProject — Angular (ng new)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTmp();

    // Simular lo que ng new generaría sin ejecutarlo realmente
    await fs.ensureDir(path.join(tmp, "src", "app"));
    await fs.writeJson(path.join(tmp, "package.json"), {
      name: "my-app",
      dependencies: {
        "@angular/core": "^17.2.0",
        "@angular/common": "^17.2.0",
        "@angular/forms": "^17.2.0",
        "@angular/router": "^17.2.0",
        rxjs: "^7.8.0",
        "zone.js": "~0.14.0",
      },
      devDependencies: {
        "@angular/cli": "^17.2.0",
        "@angular-devkit/build-angular": "^17.2.0",
        typescript: "^5.3.0",
      },
    });
    await fs.writeFile(path.join(tmp, "angular.json"), JSON.stringify({ version: 1 }), "utf-8");
    await fs.writeFile(
      path.join(tmp, "src", "main.ts"),
      `import { bootstrapApplication } from '@angular/platform-browser';\n`,
      "utf-8",
    );
    await fs.writeFile(
      path.join(tmp, "src", "app", "app.component.ts"),
      `import { Component } from '@angular/core';\n`,
      "utf-8",
    );
  });

  afterEach(async () => {
    await fs.remove(tmp);
  });

  it("uses ng new for Angular — not Vite", async () => {
    expect(await fs.pathExists(path.join(tmp, "angular.json"))).toBe(true);
    expect(await fs.pathExists(path.join(tmp, "vite.config.ts"))).toBe(false);
  });

  it("Angular project has @angular/core in package.json", async () => {
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.dependencies).toHaveProperty("@angular/core");
  });

  it("Angular project has @angular/forms in package.json", async () => {
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.dependencies).toHaveProperty("@angular/forms");
  });

  it("Angular project has angular.json", async () => {
    expect(await fs.pathExists(path.join(tmp, "angular.json"))).toBe(true);
  });

  it("Angular project has src/main.ts", async () => {
    expect(await fs.pathExists(path.join(tmp, "src", "main.ts"))).toBe(true);
  });

  it("Angular project has src/app/app.component.ts", async () => {
    expect(await fs.pathExists(path.join(tmp, "src", "app", "app.component.ts"))).toBe(true);
  });
});
