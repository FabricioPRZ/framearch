import { describe, it, expect } from "vitest";
import { ARCHITECTURES, WIP_ARCH_IDS } from "../src/architectures/index.js";
import { FRAMEWORKS } from "../src/frameworks/index.js";
import { screamingArchitecture } from "../src/architectures/screaming/index.js";
import { mvvmArchitecture } from "../src/architectures/mvvm/index.js";

describe("architecture registry", () => {
  it("each architecture has required fields", () => {
    for (const arch of ARCHITECTURES) {
      expect(arch.id).toBeTruthy();
      expect(arch.name).toBeTruthy();
      expect(arch.description).toBeTruthy();
      expect(arch.folderConvention).toBeTruthy();
      expect(typeof arch.generate).toBe("function");
    }
  });

  it("architecture ids are unique", () => {
    const ids = ARCHITECTURES.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe("framework registry", () => {
  it("each framework has required fields", () => {
    for (const fw of FRAMEWORKS) {
      expect(fw.id).toBeTruthy();
      expect(fw.name).toBeTruthy();
      expect(fw.fileExtension).toBeTruthy();
      expect(fw.testExtension).toBeTruthy();
      expect(typeof fw.supportsJsx).toBe("boolean");
    }
  });

  it("framework ids are unique", () => {
    const ids = FRAMEWORKS.map((f) => f.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe("screamingArchitecture — all frameworks", () => {
  const stableFrameworks = FRAMEWORKS.filter((f) =>
    ["react", "vue", "svelte", "angular"].includes(f.id),
  );

  for (const framework of stableFrameworks) {
    it(`generates valid templates for ${framework.name}`, () => {
      const templates = screamingArchitecture.generate({
        featureName: "auth",
        framework,
        outputDir: "/tmp/test",
      });

      expect(templates.length).toBeGreaterThan(0);

      for (const t of templates) {
        expect(typeof t.path).toBe("string");
        expect(t.path.length).toBeGreaterThan(0);
        expect(typeof t.content).toBe("string");
        expect(t.content.length).toBeGreaterThan(0);
      }
    });

    it(`${framework.name}: index.ts contains an export`, () => {
      const templates = screamingArchitecture.generate({
        featureName: "auth",
        framework,
        outputDir: "/tmp/test",
      });

      const index = templates.find((t) => t.path.endsWith("index.ts"));
      expect(index).toBeDefined();
      expect(index!.content).toContain("export");
    });
  }
});

describe("mvvmArchitecture — all frameworks", () => {
  const mvvmFrameworks = FRAMEWORKS.filter((f) =>
    ["react", "vue", "svelte", "angular"].includes(f.id),
  );

  for (const framework of mvvmFrameworks) {
    it(`generates valid templates for ${framework.name}`, () => {
      const templates = mvvmArchitecture.generate({
        featureName: "auth",
        framework,
        outputDir: "/tmp/test",
      });

      expect(templates.length).toBeGreaterThan(0);

      for (const t of templates) {
        expect(typeof t.path).toBe("string");
        expect(t.path.length).toBeGreaterThan(0);
        expect(typeof t.content).toBe("string");
        expect(t.content.length).toBeGreaterThan(0);
      }
    });

    it(`${framework.name}: index.ts contains an export`, () => {
      const templates = mvvmArchitecture.generate({
        featureName: "auth",
        framework,
        outputDir: "/tmp/test",
      });

      const index = templates.find((t) => t.path.endsWith("index.ts"));
      expect(index).toBeDefined();
      expect(index!.content).toContain("export");
    });

    it(`${framework.name}: contains domain, infrastructure, and presentation layers`, () => {
      const templates = mvvmArchitecture.generate({
        featureName: "auth",
        framework,
        outputDir: "/tmp/test",
      });

      const paths = templates.map((t) => t.path);
      expect(paths.some((p) => p.includes("/domain/"))).toBe(true);
      expect(paths.some((p) => p.includes("/infrastructure/"))).toBe(true);

      // For Angular, presentation layer is scaffolded via angularNgSteps() (ng generate),
      // not generate(). Verify the steps expose presentation paths instead.
      if (framework.id === "angular") {
        const steps = mvvmArchitecture.angularNgSteps!({
          featureName: "auth",
          framework,
          outputDir: "/tmp/test",
        });
        expect(steps.some((s) => s.tsPath.includes("/presentation/"))).toBe(true);
      } else {
        expect(paths.some((p) => p.includes("/presentation/"))).toBe(true);
      }
    });

    it(`${framework.name}: domain layer has models, repositories, and errors`, () => {
      const templates = mvvmArchitecture.generate({
        featureName: "auth",
        framework,
        outputDir: "/tmp/test",
      });

      const paths = templates.map((t) => t.path);
      expect(paths.some((p) => p.includes("/domain/models/"))).toBe(true);
      expect(paths.some((p) => p.includes("/domain/repositories/"))).toBe(true);
      expect(paths.some((p) => p.includes("/domain/errors/"))).toBe(true);
    });

    it(`${framework.name}: infrastructure layer has api, repositories, and dtos`, () => {
      const templates = mvvmArchitecture.generate({
        featureName: "auth",
        framework,
        outputDir: "/tmp/test",
      });

      const paths = templates.map((t) => t.path);

      // For Angular, api and repositories come from angularNgSteps() (ng generate),
      // not generate(). Only dtos are written directly.
      if (framework.id === "angular") {
        expect(paths.some((p) => p.includes("/infrastructure/dtos/"))).toBe(true);
        const steps = mvvmArchitecture.angularNgSteps!({
          featureName: "auth",
          framework,
          outputDir: "/tmp/test",
        });
        expect(steps.some((s) => s.tsPath.includes("/infrastructure/api/"))).toBe(true);
        expect(steps.some((s) => s.tsPath.includes("/infrastructure/repositories/"))).toBe(true);
      } else {
        expect(paths.some((p) => p.includes("/infrastructure/api/"))).toBe(true);
        expect(paths.some((p) => p.includes("/infrastructure/repositories/"))).toBe(true);
        expect(paths.some((p) => p.includes("/infrastructure/dtos/"))).toBe(true);
      }
    });
  }
});

describe("mvvmArchitecture — Angular ng steps", () => {
  const angularFramework = FRAMEWORKS.find((f) => f.id === "angular")!;

  it("angularNgSteps is defined", () => {
    expect(typeof mvvmArchitecture.angularNgSteps).toBe("function");
  });

  it("returns steps for api, repositories, view-model, and components", () => {
    const steps = mvvmArchitecture.angularNgSteps!({
      featureName: "auth",
      framework: angularFramework,
      outputDir: "/tmp/test",
    });

    expect(steps.some((s) => s.tsPath.includes("/infrastructure/api/"))).toBe(true);
    expect(steps.some((s) => s.tsPath.includes("/infrastructure/repositories/"))).toBe(true);
    expect(steps.some((s) => s.tsPath.includes("/presentation/view-models/"))).toBe(true);
    expect(steps.some((s) => s.tsPath.includes("/presentation/views/"))).toBe(true);
  });

  it("each step has ngGenerate, tsPath, and tsContent", () => {
    const steps = mvvmArchitecture.angularNgSteps!({
      featureName: "auth",
      framework: angularFramework,
      outputDir: "/tmp/test",
    });

    for (const step of steps) {
      expect(typeof step.ngGenerate).toBe("string");
      expect(step.ngGenerate.length).toBeGreaterThan(0);
      expect(typeof step.tsPath).toBe("string");
      expect(step.tsPath.length).toBeGreaterThan(0);
      expect(typeof step.tsContent).toBe("string");
      expect(step.tsContent.length).toBeGreaterThan(0);
    }
  });
});

describe("WIP architectures", () => {
  it("throw when generate() is called", () => {
    const wipArchs = ARCHITECTURES.filter((a) => WIP_ARCH_IDS.has(a.id));

    for (const arch of wipArchs) {
      expect(() =>
        arch.generate({
          featureName: "auth",
          framework: FRAMEWORKS[0]!,
          outputDir: "/tmp/test",
        }),
      ).toThrow();
    }
  });
});