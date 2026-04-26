import path from "node:path";
import { select, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";

import { FRAMEWORKS } from "./frameworks/index.js";
import { ARCHITECTURES, WIP_ARCH_IDS } from "./architectures/index.js";
import { runGenerator, previewGenerator } from "./generator.js";
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

  // 1 ── Feature name
  const featureName = await input({
    message: "Feature name:",
    default: "auth",
    validate: (v) => {
      if (!v.trim()) return "Feature name cannot be empty.";
      if (!/^[a-z][a-z0-9-]*$/.test(v.trim()))
        return "Use lowercase letters, numbers, and hyphens only (e.g. auth, user-profile).";
      return true;
    },
    transformer: (v) => v.toLowerCase().trim(),
  });

  // 2 ── Framework
  const frameworkId = await select({
    message: "Framework:",
    choices: FRAMEWORKS.map((f) => ({
      name: `${f.name}  ${chalk.dim(f.description)}`,
      value: f.id,
    })),
  });

  const framework = FRAMEWORKS.find((f) => f.id === frameworkId)!;

  // 3 ── Architecture
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

  // 4 ── Output directory
  const outputDir = await input({
    message: "Output directory:",
    default: ".",
    validate: (v) => (v.trim() ? true : "Output directory cannot be empty."),
  });

  const answers: CliAnswers = { featureName, framework, architecture, outputDir };

  // 5 ── Dry-run preview
  const dryRun = await confirm({
    message: "Preview files without writing? (dry-run)",
    default: false,
  });

  if (dryRun) {
    const templates = previewGenerator({ featureName, framework, architecture, outputDir });
    console.log(`\n${chalk.bold("Files that would be created:")}`);
    for (const t of templates) {
      console.log(`  ${chalk.green("+")} ${t.path}`);
    }
    console.log();
    return;
  }

  printSummary(answers);

  const ok = await confirm({ message: "Generate files?", default: true });
  if (!ok) {
    console.log(chalk.dim("Aborted."));
    return;
  }

  // 6 ── Generate
  const spinner = ora("Generating files…").start();
  try {
    const result = await runGenerator({ featureName, framework, architecture, outputDir });
    spinner.succeed(chalk.green("Done!"));

    console.log(`\n${chalk.bold("Created:")}`);
    for (const f of result.files) {
      const rel = path.relative(process.cwd(), f);
      console.log(`  ${chalk.green("+")} ${rel}`);
    }

    console.log(`
${chalk.bold("Next steps:")}
  1. Open ${chalk.cyan(path.join(outputDir, "src/features", featureName))}
  2. Connect the service to your real API
  3. Import the feature from its ${chalk.cyan("index.ts")} barrel
`);
  } catch (err) {
    spinner.fail(chalk.red("Generation failed"));
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(message));
    process.exit(1);
  }
}
