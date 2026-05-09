import path from "node:path";
import { select, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

import { FRAMEWORKS } from "./frameworks/index.js";
import { ARCHITECTURES, WIP_ARCH_IDS } from "./architectures/index.js";
import { runGenerator, previewGenerator } from "./generator.js";
import { scaffoldProject } from "./scaffold.js";
import { detectExistingProject } from "./detector.js";
import { injectReactFeatureRoutes } from "./featureRoutes.js";
import { runAngularNgSteps } from "./angularGenerator.js";
import type { CliAnswers } from "./types.js";

const BRAND = chalk.bold.hex("#7C3AED")("framearch");

function printBanner(): void {
  console.log(`
  ${BRAND}
  ${chalk.dim("scaffold any feature, your way")}
  `);
}

function printSummary(answers: CliAnswers): void {
  const { featureName, framework, architecture, outputDir } = answers;

  console.log(`
${chalk.bold("Summary")}
  ${chalk.dim("Feature:")}      ${featureName}
  ${chalk.dim("Framework:")}    ${framework.name}
  ${chalk.dim("Architecture:")} ${architecture.name}
  ${chalk.dim("Output:")}       ${path.resolve(outputDir)}
`);
}

export async function runCli(): Promise<void> {
  printBanner();

  const outputDir = await input({
    message: "Output directory:",
    default: ".",
    validate: (v) => (v.trim() ? true : "Output directory cannot be empty."),
  });

  const detected = await detectExistingProject(outputDir);

  let framework: (typeof FRAMEWORKS)[number];

  if (detected) {
    console.log(
      chalk.green(
        `\n✓ Detected ${detected.framework.name} project (${
          detected.buildTool
        })${detected.hasTypeScript ? " + TypeScript" : ""}\n`,
      ),
    );

    const useDetected = await confirm({
      message: `Use detected ${detected.framework.name} project?`,
      default: true,
    });

    if (useDetected) {
      framework = detected.framework;
    } else {
      framework = await askForFramework();
    }
  } else {
    const scaffold = await confirm({
      message: "No existing project found. Scaffold a new project?",
      default: true,
    });

    if (scaffold) {
      framework = await askForFramework();

      // ── Angular uses its own CLI, no build-tool selection needed ───────────
      const isAngular = framework.id === "angular";

      const buildTool = isAngular
        ? "ng-new"
        : await select({
            message: "Build tool:",
            choices: [
              { name: "Vite  Fast HMR, lightweight", value: "vite" },
              ...(framework.id === "react"
                ? [{ name: "Next.js  Full-stack React framework", value: "nextjs" }]
                : []),
            ],
          });

      const typescript = await confirm({
        message: "Use TypeScript?",
        default: true,
      });

      // ── Angular: ask for the project name before calling ng new ────────────
      let angularProjectName: string | undefined;
      if (isAngular) {
        angularProjectName = await input({
          message: "Project name:",
          default: path.basename(path.resolve(outputDir)) || "my-angular-app",
          validate: (v) => {
            if (!v.trim()) return "Project name cannot be empty.";
            if (!/^[a-z][a-z0-9-]*$/.test(v.trim())) {
              return "Use lowercase letters, numbers, and hyphens only (e.g. my-app).";
            }
            return true;
          },
          transformer: (v) => v.toLowerCase().trim(),
        });
      }

      const scaffoldSpinner = ora(
        isAngular ? "Checking Angular CLI…" : "Scaffolding project…",
      ).start();

      try {
        const result = await scaffoldProject(
          {
            outputDir,
            framework,
            buildTool: buildTool as "vite" | "nextjs",
            typescript,
            projectName: angularProjectName,
          },
          // Forward status messages from scaffoldProject to the spinner
          (msg) => {
            scaffoldSpinner.text = msg;
          },
        );

        scaffoldSpinner.succeed(chalk.green("Project scaffolded!"));

        console.log(`\n${chalk.bold("Created project files:")}`);
        for (const f of result.files) {
          const rel = path.relative(process.cwd(), f);
          console.log(`  ${chalk.green("+")} ${rel}`);
        }

        // For non-Angular frameworks, run npm install manually
        if (!isAngular) {
          const installSpinner = ora("Installing dependencies…").start();
          await execAsync("npm install", { cwd: path.resolve(outputDir) });
          installSpinner.succeed(chalk.green("Dependencies installed!"));
        }
        // Angular's ng new already runs npm install (--skip-install=false)
      } catch (err) {
        scaffoldSpinner.fail(chalk.red("Scaffold failed"));
        throw err;
      }
    } else {
      framework = await askForFramework();
    }
  }

  const featureName = await input({
    message: "Feature name:",
    default: "auth",
    validate: (v) => {
      if (!v.trim()) return "Feature name cannot be empty.";
      if (!/^[a-z][a-z0-9-]*$/.test(v.trim())) {
        return "Use lowercase letters, numbers, and hyphens only (e.g. auth, user-profile).";
      }
      return true;
    },
    transformer: (v) => v.toLowerCase().trim(),
  });

  const architectureId = await select({
    message: "Architecture:",
    choices: ARCHITECTURES.map((a) => {
      const wip = WIP_ARCH_IDS.has(a.id);

      return {
        name: `${a.name}  ${wip ? chalk.yellow("[WIP] ") : ""}${chalk.dim(a.description)}`,
        value: a.id,
      };
    }),
  });

  const architecture = ARCHITECTURES.find((a) => a.id === architectureId)!;

  if (WIP_ARCH_IDS.has(architectureId)) {
    console.log(
      chalk.yellow(
        `\n⚠  "${architecture.name}" is still a work in progress. Templates are not complete yet.\n`,
      ),
    );
    process.exit(1);
  }

  const answers: CliAnswers = {
    featureName,
    framework,
    architecture,
    outputDir,
  };

  const dryRun = await confirm({
    message: "Preview files without writing? (dry-run)",
    default: false,
  });

  if (dryRun) {
    const templates = previewGenerator({
      featureName,
      framework,
      architecture,
      outputDir,
    });

    console.log(`\n${chalk.bold("Files that would be created:")}`);

    for (const t of templates) {
      console.log(`  ${chalk.green("+")} ${t.path}`);
    }

    // For Angular, also show the ng generate steps
    if (framework.id === "angular" && architecture.angularNgSteps) {
      const steps = architecture.angularNgSteps({ featureName, framework, outputDir });
      console.log(`\n${chalk.bold("Angular CLI commands that would run:")}`);
      for (const s of steps) {
        console.log(`  ${chalk.cyan("ng generate")} ${s.ngGenerate}`);
      }
    }

    console.log();
    return;
  }

  printSummary(answers);

  const ok = await confirm({
    message: "Generate files?",
    default: true,
  });

  if (!ok) {
    console.log(chalk.dim("Aborted."));
    return;
  }

  const spinner = ora("Generating files…").start();

  try {
    // ── 1. Write domain / infrastructure / barrel files ─────────────────────
    const result = await runGenerator({
      featureName,
      framework,
      architecture,
      outputDir,
    });

    spinner.succeed(chalk.green("Done!"));

    console.log(`\n${chalk.bold("Created:")}`);
    for (const f of result.files) {
      const rel = path.relative(process.cwd(), f);
      console.log(`  ${chalk.green("+")} ${rel}`);
    }

    // ── 2. React MVVM: inject routes into Router.tsx ─────────────────────────
    if (framework.id === "react" && architecture.id === "mvvm") {
      const Feat = featureName.charAt(0).toUpperCase() + featureName.slice(1);

      await injectReactFeatureRoutes(outputDir, {
        featureName,
        routes: [
          {
            path: `/${featureName}/login`,
            componentName: `Login${Feat}View`,
            importPath: `../../features/${featureName}`,
          },
          {
            path: `/${featureName}/register`,
            componentName: `Register${Feat}View`,
            importPath: `../../features/${featureName}`,
          },
        ],
      });
    }

    // ── 3. Angular: run ng generate + inject auth logic ──────────────────────
    if (framework.id === "angular" && architecture.angularNgSteps) {
      const ngSpinner = ora("Generating Angular components and services…").start();

      try {
        const steps = architecture.angularNgSteps({ featureName, framework, outputDir });

        await runAngularNgSteps(outputDir, steps, (msg) => {
          ngSpinner.text = msg;
        });

        ngSpinner.succeed(chalk.green("Angular components and services generated!"));

        console.log(`\n${chalk.bold("Angular files scaffolded:")}`);
        for (const s of steps) {
          console.log(`  ${chalk.green("+")} ${s.tsPath}`);
          if (s.htmlPath) console.log(`  ${chalk.green("+")} ${s.htmlPath}`);
        }
      } catch (err) {
        ngSpinner.fail(chalk.red("Angular component generation failed"));
        throw err;
      }
    }

    // ── 4. Print next steps ──────────────────────────────────────────────────
    const devCmd =
      framework.id === "angular" ? "ng serve" : "npm run dev";

    console.log(`
${chalk.bold("Next steps:")}
  1. Run ${chalk.cyan(devCmd)} to start the dev server
  2. Open ${chalk.cyan(path.join(outputDir, "src/app/features", featureName))}
  3. Connect the repository to your real API in infrastructure/
  4. Import the feature from its ${chalk.cyan("index.ts")} barrel
`);
  } catch (err) {
    spinner.fail(chalk.red("Generation failed"));

    const message = err instanceof Error ? err.message : String(err);

    console.error(chalk.red(message));
    process.exit(1);
  }
}

async function askForFramework(): Promise<(typeof FRAMEWORKS)[number]> {
  const frameworkId = await select({
    message: "Framework:",
    choices: FRAMEWORKS.map((f) => ({
      name: `${f.name}  ${chalk.dim(f.description)}`,
      value: f.id,
    })),
  });

  return FRAMEWORKS.find((f) => f.id === frameworkId)!;
}