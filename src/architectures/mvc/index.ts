import type { Architecture, FileTemplate, GenerateContext } from "../../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// MVC Architecture
//
// Convention:
//   src/
//     models/         → Data shape & domain logic
//     views/          → UI components
//     controllers/    → Orchestrates model ↔ view
//
// 📌 TODO for contributors:
//   Implement `generate()` returning FileTemplate[] for each supported framework.
//   See src/architectures/screaming/index.ts for a complete reference.
// ─────────────────────────────────────────────────────────────────────────────

function generate(_ctx: GenerateContext): FileTemplate[] {
  // TODO: implement per-framework templates
  // Hint: use _ctx.framework.id to branch per framework,
  // and _ctx.featureName / _ctx.outputDir for paths.
  throw new Error(
    "MVC architecture templates are not yet implemented. " +
      "See CONTRIBUTING.md for instructions on adding them.",
  );
}

export const mvcArchitecture: Architecture = {
  id: "mvc",
  name: "MVC",
  description: "Classic Model-View-Controller separation.",
  folderConvention: "src/{models, views, controllers}/<Feature>/",
  generate,
};
