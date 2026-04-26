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

export interface Architecture {
  id: string;
  name: string;
  description: string;
  /** Short summary of the folder conventions used by this architecture */
  folderConvention: string;
  /**
   * Returns the list of files that should be created for `featureName`.
   * Keep this pure — no side effects, no I/O.
   */
  generate(ctx: GenerateContext): FileTemplate[];
}

export interface CliAnswers {
  framework: Framework;
  architecture: Architecture;
  featureName: string;
  outputDir: string;
}
