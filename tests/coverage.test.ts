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
const angularFramework = FRAMEWORKS.find((f) => f.id === "angular")!;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function makeTmp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "framearch-cov-"));
}

async function writePackageJson(dir: string, deps: Record<string, string>, devDeps: Record<string, string> = {}) {
  await fs.writeJson(path.join(dir, "package.json"), {
    name: "test-app",
    dependencies: deps,
    devDependencies: devDeps,
  });
}

// ─── detectExistingProject ───────────────────────────────────────────────────

describe("detectExistingProject", () => {
  let tmp: string;

  beforeEach(async () => { tmp = await makeTmp(); });
  afterEach(async () => { await fs.remove(tmp); });

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

  beforeEach(async () => { tmp = await makeTmp(); });
  afterEach(async () => { await fs.remove(tmp); });

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

  async function writeRouter(content: string = routerTemplate) {
    const routerDir = path.join(tmp, "src", "core", "navigation");
    await fs.ensureDir(routerDir);
    await fs.writeFile(path.join(routerDir, "Router.tsx"), content, "utf-8");
  }

  async function readRouter(): Promise<string> {
    return fs.readFile(path.join(tmp, "src", "core", "navigation", "Router.tsx"), "utf-8");
  }

  it("does nothing when Router.tsx does not exist", async () => {
    // no router file written — should not throw
    await expect(
      injectReactFeatureRoutes(tmp, {
        featureName: "auth",
        routes: [{ path: "/auth/login", componentName: "LoginAuthView", importPath: "../../features/auth" }],
      }),
    ).resolves.toBeUndefined();
  });

  it("injects import statements before the BrowserRouter import", async () => {
    await writeRouter();
    await injectReactFeatureRoutes(tmp, {
      featureName: "auth",
      routes: [{ path: "/auth/login", componentName: "LoginAuthView", importPath: "../../features/auth" }],
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
        { path: "/auth/register", componentName: "RegisterAuthView", importPath: "../../features/auth" },
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
      routes: [{ path: "/auth/login", componentName: "LoginAuthView", importPath: "../../features/auth" }],
    });
    const content = await readRouter();
    expect(content).toContain("{/* Feature routes will be added here */}");
  });

  it("injects multiple routes in one call", async () => {
    await writeRouter();
    await injectReactFeatureRoutes(tmp, {
      featureName: "payments",
      routes: [
        { path: "/payments/list", componentName: "ListPaymentsView", importPath: "../../features/payments" },
        { path: "/payments/detail", componentName: "DetailPaymentsView", importPath: "../../features/payments" },
      ],
    });
    const content = await readRouter();
    expect(content).toContain("ListPaymentsView");
    expect(content).toContain("DetailPaymentsView");
  });
});

// ─── scaffoldProject ─────────────────────────────────────────────────────────

describe("scaffoldProject", () => {
  let tmp: string;

  beforeEach(async () => { tmp = await makeTmp(); });
  afterEach(async () => { await fs.remove(tmp); });

  it("creates files on disk for React + Vite + TypeScript", async () => {
    const result = await scaffoldProject({
      outputDir: tmp,
      framework: reactFramework,
      buildTool: "vite",
      typescript: true,
    });

    expect(result.files.length).toBeGreaterThan(0);
    for (const f of result.files) {
      expect(await fs.pathExists(f)).toBe(true);
    }
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

  it("writes package.json", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: true });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.name).toBe("my-app");
    expect(pkg.dependencies).toHaveProperty("react");
  });

  it("includes react-dom and react-router-dom for React", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: true });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.dependencies).toHaveProperty("react-dom");
    expect(pkg.dependencies).toHaveProperty("react-router-dom");
  });

  it("writes tsconfig.json when typescript is true", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: true });
    expect(await fs.pathExists(path.join(tmp, "tsconfig.json"))).toBe(true);
  });

  it("does not write tsconfig.json when typescript is false", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: false });
    expect(await fs.pathExists(path.join(tmp, "tsconfig.json"))).toBe(false);
  });

  it("writes vite.config.ts for Vite build tool", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: true });
    expect(await fs.pathExists(path.join(tmp, "vite.config.ts"))).toBe(true);
  });

  it("writes vite.config.js for Vite without TypeScript", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: false });
    expect(await fs.pathExists(path.join(tmp, "vite.config.js"))).toBe(true);
  });

  it("writes index.html for Vite", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: true });
    expect(await fs.pathExists(path.join(tmp, "index.html"))).toBe(true);
  });

  it("writes next.config.mjs for Next.js build tool", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "nextjs", typescript: true });
    expect(await fs.pathExists(path.join(tmp, "next.config.mjs"))).toBe(true);
  });

  it("does not write vite.config for Next.js", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "nextjs", typescript: true });
    expect(await fs.pathExists(path.join(tmp, "vite.config.ts"))).toBe(false);
  });

  it("writes .gitignore", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: true });
    expect(await fs.pathExists(path.join(tmp, ".gitignore"))).toBe(true);
  });

  it("writes .env and .env.example", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: true });
    expect(await fs.pathExists(path.join(tmp, ".env"))).toBe(true);
    expect(await fs.pathExists(path.join(tmp, ".env.example"))).toBe(true);
  });

  it("scaffolds Vue + Vite correctly", async () => {
    const result = await scaffoldProject({ outputDir: tmp, framework: vueFramework, buildTool: "vite", typescript: true });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.dependencies).toHaveProperty("vue");
    expect(result.files.length).toBeGreaterThan(0);
  });

  it("scaffolds Svelte + Vite correctly", async () => {
    await scaffoldProject({ outputDir: tmp, framework: svelteFramework, buildTool: "vite", typescript: true });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.dependencies).toHaveProperty("svelte");
  });

  it("scaffolds Angular correctly", async () => {
    await scaffoldProject({ outputDir: tmp, framework: angularFramework, buildTool: "vite", typescript: true });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.dependencies).toHaveProperty("@angular/core");
  });

  it("package.json scripts include dev and build for vite", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: true });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.scripts.dev).toBe("vite");
    expect(pkg.scripts.build).toContain("vite build");
  });

  it("package.json scripts include dev, build, start for nextjs", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "nextjs", typescript: true });
    const pkg = await fs.readJson(path.join(tmp, "package.json"));
    expect(pkg.scripts.dev).toBe("next dev");
    expect(pkg.scripts.start).toBe("next start");
  });

  it("writes main entry file", async () => {
    const result = await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: true });
    const hasMain = result.files.some((f) => f.includes("main."));
    expect(hasMain).toBe(true);
  });

  it("writes App component", async () => {
    const result = await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: true });
    const hasApp = result.files.some((f) => f.includes("App."));
    expect(hasApp).toBe(true);
  });

  it(".gitignore references dist for vite", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "vite", typescript: true });
    const gitignore = await fs.readFile(path.join(tmp, ".gitignore"), "utf-8");
    expect(gitignore).toContain("dist");
  });

  it(".gitignore references .next for nextjs", async () => {
    await scaffoldProject({ outputDir: tmp, framework: reactFramework, buildTool: "nextjs", typescript: true });
    const gitignore = await fs.readFile(path.join(tmp, ".gitignore"), "utf-8");
    expect(gitignore).toContain(".next");
  });
});