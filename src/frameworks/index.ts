import type { Framework } from "../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Framework registry
//
// To add a new framework:
//   1. Create a new object implementing the Framework interface below.
//   2. Add it to the FRAMEWORKS array.
//   3. Update any architecture templates that need framework-specific content.
// ─────────────────────────────────────────────────────────────────────────────

export const FRAMEWORKS: Framework[] = [
  {
    id: "react",
    name: "React",
    description: "React with TypeScript",
    fileExtension: "tsx",
    testExtension: "test.tsx",
    supportsJsx: true,
  },
  {
    id: "vue",
    name: "Vue 3",
    description: "Vue 3 with Composition API and TypeScript",
    fileExtension: "vue",
    testExtension: "spec.ts",
    supportsJsx: false,
  },
  {
    id: "svelte",
    name: "Svelte",
    description: "Svelte with TypeScript",
    fileExtension: "svelte",
    testExtension: "test.ts",
    supportsJsx: false,
  },
  {
    id: "angular",
    name: "Angular",
    description: "Angular with TypeScript",
    fileExtension: "ts",
    testExtension: "spec.ts",
    supportsJsx: false,
  },
  // ── Add new frameworks above this line ──
];

export function getFrameworkById(id: string): Framework | undefined {
  return FRAMEWORKS.find((f) => f.id === id);
}
