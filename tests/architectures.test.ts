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
      expect(paths.some((p) => p.includes("/presentation/"))).toBe(true);
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
      expect(paths.some((p) => p.includes("/infrastructure/api/"))).toBe(true);
      expect(paths.some((p) => p.includes("/infrastructure/repositories/"))).toBe(true);
      expect(paths.some((p) => p.includes("/infrastructure/dtos/"))).toBe(true);
    });
  }
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
