import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { runGenerator, previewGenerator } from "../src/generator.js";
import { screamingArchitecture } from "../src/architectures/screaming/index.js";
import { FRAMEWORKS } from "../src/frameworks/index.js";

const reactFramework = FRAMEWORKS.find((f) => f.id === "react")!;
const vueFramework = FRAMEWORKS.find((f) => f.id === "vue")!;

describe("previewGenerator", () => {
  it("returns FileTemplate[] without touching the filesystem", () => {
    const templates = previewGenerator({
      featureName: "auth",
      framework: reactFramework,
      architecture: screamingArchitecture,
      outputDir: "/fake/dir",
    });

    expect(templates.length).toBeGreaterThan(0);
    for (const t of templates) {
      expect(t).toHaveProperty("path");
      expect(t).toHaveProperty("content");
      expect(typeof t.path).toBe("string");
      expect(typeof t.content).toBe("string");
    }
  });

  it("uses the featureName in generated paths", () => {
    const templates = previewGenerator({
      featureName: "auth",
      framework: reactFramework,
      architecture: screamingArchitecture,
      outputDir: ".",
    });

    const allPaths = templates.map((t) => t.path).join("\n");
    expect(allPaths).toContain("auth");
  });

  it("generates an index.ts barrel file", () => {
    const templates = previewGenerator({
      featureName: "auth",
      framework: reactFramework,
      architecture: screamingArchitecture,
      outputDir: ".",
    });

    const hasIndex = templates.some((t) => t.path.endsWith("index.ts"));
    expect(hasIndex).toBe(true);
  });

  it("generates Vue-specific files for Vue framework", () => {
    const templates = previewGenerator({
      featureName: "auth",
      framework: vueFramework,
      architecture: screamingArchitecture,
      outputDir: ".",
    });

    const paths = templates.map((t) => t.path);
    const hasVueFile = paths.some((p) => p.endsWith(".vue"));
    expect(hasVueFile).toBe(true);
  });

  it("generates React-specific files for React framework", () => {
    const templates = previewGenerator({
      featureName: "auth",
      framework: reactFramework,
      architecture: screamingArchitecture,
      outputDir: ".",
    });

    const paths = templates.map((t) => t.path);
    const hasTsxFile = paths.some((p) => p.endsWith(".tsx"));
    expect(hasTsxFile).toBe(true);
  });
});

describe("runGenerator", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "framearch-test-"));
  });

  it("writes files to the output directory", async () => {
    const result = await runGenerator({
      featureName: "auth",
      framework: reactFramework,
      architecture: screamingArchitecture,
      outputDir: tmpDir,
    });

    expect(result.files.length).toBeGreaterThan(0);

    for (const filePath of result.files) {
      const exists = await fs.pathExists(filePath);
      expect(exists).toBe(true);
    }
  });

  it("creates nested directories as needed", async () => {
    await runGenerator({
      featureName: "auth",
      framework: reactFramework,
      architecture: screamingArchitecture,
      outputDir: tmpDir,
    });

    const featureDir = path.join(tmpDir, "src", "features", "auth");
    const exists = await fs.pathExists(featureDir);
    expect(exists).toBe(true);
  });

  it("file content is non-empty", async () => {
    const result = await runGenerator({
      featureName: "auth",
      framework: reactFramework,
      architecture: screamingArchitecture,
      outputDir: tmpDir,
    });

    for (const filePath of result.files) {
      const content = await fs.readFile(filePath, "utf-8");
      expect(content.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses the custom featureName in file paths", async () => {
    const result = await runGenerator({
      featureName: "payments",
      framework: reactFramework,
      architecture: screamingArchitecture,
      outputDir: tmpDir,
    });

    const allPaths = result.files.join("\n");
    expect(allPaths).toContain("payments");
  });

  it("returns the resolved outputDir", async () => {
    const result = await runGenerator({
      featureName: "auth",
      framework: reactFramework,
      architecture: screamingArchitecture,
      outputDir: tmpDir,
    });

    expect(result.outputDir).toBe(path.resolve(tmpDir));
  });
});
