import path from "node:path";
import fs from "fs-extra";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AngularNgStep } from "./types.js";

const execAsync = promisify(exec);

/**
 * Checks whether the Angular CLI is available globally.
 * If not found, installs @angular/cli via npm.
 *
 * @param onStatus - optional callback to relay status messages to a spinner
 */
export async function ensureAngularCli(onStatus?: (msg: string) => void): Promise<void> {
  try {
    await execAsync("ng version");
  } catch {
    onStatus?.("Angular CLI not found — installing @angular/cli globally…");
    await execAsync("npm install -g @angular/cli");
    onStatus?.("@angular/cli installed successfully.");
  }
}

/**
 * Runs a list of `ng generate` steps inside an Angular project directory.
 *
 * For each step:
 *  1. Runs `ng generate <step.ngGenerate>` so Angular creates the `.html`,
 *     `.css`, and scaffold `.ts` files.
 *  2. Overwrites the generated `.ts` with `step.tsContent` (auth logic).
 *  3. If `step.htmlPath` + `step.htmlContent` are provided, writes a minimal
 *     functional HTML skeleton so the component renders without styles.
 *     The `.css` file is left empty for the user to fill in.
 *
 * @param projectDir - absolute or relative path to the Angular project root
 * @param steps      - list of AngularNgStep objects from the chosen architecture
 * @param onStatus   - optional callback to relay step messages to a spinner
 */
export async function runAngularNgSteps(
  projectDir: string,
  steps: AngularNgStep[],
  onStatus?: (msg: string) => void,
): Promise<void> {
  const resolved = path.resolve(projectDir);

  for (const step of steps) {
    const verb = step.ngGenerate.split(" ")[0]; // "component" | "service" | …
    onStatus?.(`ng generate ${verb}…`);

    await execAsync(`ng generate ${step.ngGenerate}`, { cwd: resolved });

    // Overwrite the generated .ts with the architecture's auth logic
    const tsAbsolute = path.resolve(resolved, step.tsPath);
    await fs.ensureDir(path.dirname(tsAbsolute));
    await fs.writeFile(tsAbsolute, step.tsContent, "utf-8");

    // Write the minimal HTML skeleton if provided
    if (step.htmlPath && step.htmlContent) {
      const htmlAbsolute = path.resolve(resolved, step.htmlPath);
      await fs.writeFile(htmlAbsolute, step.htmlContent, "utf-8");
    }
  }
}
