import path from "node:path";
import fs from "fs-extra";
import type { Architecture, Framework, FileTemplate } from "./types.js";

export interface GeneratorOptions {
  featureName: string;
  framework: Framework;
  architecture: Architecture;
  outputDir: string;
}

export interface GeneratorResult {
  files: string[];
  outputDir: string;
}

/**
 * Runs the chosen architecture's `generate()` and writes all files to disk.
 * Returns the list of written file paths.
 */
export async function runGenerator(options: GeneratorOptions): Promise<GeneratorResult> {
  const { featureName, framework, architecture, outputDir } = options;

  const templates: FileTemplate[] = architecture.generate({
    featureName,
    framework,
    outputDir,
  });

  const writtenFiles: string[] = [];

  for (const template of templates) {
    const absolutePath = path.resolve(outputDir, template.path);
    await fs.ensureDir(path.dirname(absolutePath));
    await fs.writeFile(absolutePath, template.content, "utf-8");
    writtenFiles.push(absolutePath);
  }

  return { files: writtenFiles, outputDir: path.resolve(outputDir) };
}

/**
 * Pure helper — does not write to disk.
 * Useful in tests and dry-run mode.
 */
export function previewGenerator(options: GeneratorOptions): FileTemplate[] {
  return options.architecture.generate({
    featureName: options.featureName,
    framework: options.framework,
    outputDir: options.outputDir,
  });
}
