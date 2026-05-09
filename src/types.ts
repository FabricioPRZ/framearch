// ─────────────────────────────────────────────────────────────────────────────
// Core types for framearch
// When adding a new framework or architecture, implement these interfaces.
// ─────────────────────────────────────────────────────────────────────────────

export interface FileTemplate {
  /** Relative path from the output directory, e.g. "src/features/auth/hooks/useAuth.ts" */
  path: string;
  /** Full file content as a string */
  content: string;
}

export interface Framework {
  id: string;
  name: string;
  description: string;
  /** Primary source file extension (e.g. "tsx", "vue", "svelte") */
  fileExtension: string;
  /** Test file extension (e.g. "test.tsx", "spec.ts") */
  testExtension: string;
  /** Whether the framework supports JSX natively */
  supportsJsx: boolean;
}

export interface GenerateContext {
  /** Name of the feature being generated (e.g. "auth") */
  featureName: string;
  /** Chosen framework */
  framework: Framework;
  /** Absolute path where files will be written */
  outputDir: string;
}

/**
 * Represents a single step executed by `ng generate` followed by an immediate
 * overwrite of the generated `.ts` file with domain/auth logic.
 *
 * The `.html` and `.css` files produced by `ng generate component` are left
 * untouched so the user can apply their own styles and markup.
 */
export interface AngularNgStep {
  /**
   * The subcommand passed to `ng generate` (without the "ng generate" prefix).
   * e.g. "component features/auth/presentation/views/login-auth --standalone --skip-tests"
   */
  ngGenerate: string;
  /**
   * Path of the `.ts` file to overwrite after `ng generate` runs.
   * Relative to the project root (e.g. "src/app/features/auth/...").
   */
  tsPath: string;
  /** Content written into the `.ts` file — contains all auth logic. */
  tsContent: string;
  /**
   * Optional path to the `.html` file to write after `ng generate component`.
   * If omitted the ng-generated placeholder HTML is left as-is.
   * Provide a minimal functional template (no CSS classes) so the component
   * actually renders; the user can later add their own markup and styles.
   */
  htmlPath?: string;
  /** Minimal functional HTML template (no styling). */
  htmlContent?: string;
}

export interface Architecture {
  id: string;
  name: string;
  description: string;
  /** Short summary of the folder conventions used by this architecture */
  folderConvention: string;
  /**
   * Returns the list of files that should be created for `featureName`.
   * Keep this pure — no side effects, no I/O.
   *
   * For Angular, this returns only the direct-write files (domain layer,
   * DTOs, barrel index). Components and services are handled by angularNgSteps.
   */
  generate(ctx: GenerateContext): FileTemplate[];
  /**
   * Angular-only: returns the `ng generate` steps to run after `ng new`.
   * Each step runs `ng generate <ngGenerate>` inside the project directory
   * and then overwrites the generated `.ts` with the provided auth logic.
   * The `.html` / `.css` files are left for the user to customise unless
   * `htmlPath` + `htmlContent` are provided for a minimal functional skeleton.
   *
   * If absent, the Angular scaffold falls back to writing files directly
   * (same as other frameworks).
   */
  angularNgSteps?(ctx: GenerateContext): AngularNgStep[];
}

export interface CliAnswers {
  framework: Framework;
  architecture: Architecture;
  featureName: string;
  outputDir: string;
}