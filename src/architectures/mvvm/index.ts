import type { Architecture, FileTemplate, GenerateContext } from "../../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// MVVM Architecture
//
// Convention:
//   src/
//     models/       → Pure data / domain entities
//     viewModels/   → State management & business logic (observable)
//     views/        → UI components (bind to viewModel)
//
// 📌 TODO for contributors:
//   Implement `generate()` returning FileTemplate[] for each supported framework.
//   See src/architectures/screaming/index.ts for a complete reference.
// ─────────────────────────────────────────────────────────────────────────────

function generate(_ctx: GenerateContext): FileTemplate[] {
  throw new Error(
    "MVVM architecture templates are not yet implemented. " +
      "See CONTRIBUTING.md for instructions on adding them.",
  );
}

export const mvvmArchitecture: Architecture = {
  id: "mvvm",
  name: "MVVM",
  description: "Model-View-ViewModel: reactive bindings between VM and View.",
  folderConvention: "src/{models, viewModels, views}/<Feature>/",
  generate,
};
