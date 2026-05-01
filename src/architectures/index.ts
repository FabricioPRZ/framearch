import type { Architecture } from "../types.js";
import { screamingArchitecture } from "./screaming/index.js";
import { mvcArchitecture } from "./mvc/index.js";
import { mvvmArchitecture } from "./mvvm/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Architecture registry
//
// To add a new architecture:
//   1. Create a folder under src/architectures/<your-arch>/
//   2. Export an object implementing the Architecture interface (see types.ts)
//   3. Import and add it to ARCHITECTURES below
//   4. Mark it as (wip: true) until templates are complete — the CLI will warn users
// ─────────────────────────────────────────────────────────────────────────────

interface RegistryEntry {
  arch: Architecture;
  /** Set to true if the architecture is still being worked on */
  wip?: boolean;
}

const registry: RegistryEntry[] = [
  { arch: screamingArchitecture },
  { arch: mvcArchitecture, wip: true },
  { arch: mvvmArchitecture },
  // ── Add new architectures above this line ──
];

export const ARCHITECTURES: Architecture[] = registry.map((e) => e.arch);

export const WIP_ARCH_IDS = new Set(registry.filter((e) => e.wip).map((e) => e.arch.id));

export function getArchitectureById(id: string): Architecture | undefined {
  return ARCHITECTURES.find((a) => a.id === id);
}
