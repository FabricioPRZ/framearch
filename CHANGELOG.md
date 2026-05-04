# Changelog

All notable changes to framearch will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

#### CLI & Core
- Interactive CLI with `@inquirer/prompts` (output directory, framework, feature name, architecture, dry-run)
- Auto-detection of existing projects via `detectExistingProject()` — reads `package.json` and identifies framework, build tool, and TypeScript presence
- Project scaffolding via `scaffoldProject()` — generates `package.json`, build config, `tsconfig.json`, `.env`, `.gitignore`, entry point, and `App` component
- Automatic `npm install` after project scaffold
- Feature route injection for React projects via `injectReactFeatureRoutes()` — patches `src/core/navigation/Router.tsx` in place
- Dry-run mode — previews all files that would be generated without writing to disk
- `previewGenerator()` pure helper (no I/O, used in dry-run and tests)
- `runGenerator()` async helper that writes `FileTemplate[]` to disk

#### Framework Registry (`src/frameworks/index.ts`)
- **React** — `.tsx` / `test.tsx`, JSX support
- **Vue 3** — `.vue` / `spec.ts`, Composition API
- **Svelte** — `.svelte` / `test.ts`
- **Angular** — `.ts` / `spec.ts`
- `getFrameworkById()` lookup helper

#### Architecture Registry (`src/architectures/index.ts`)
- Registry with optional `wip` flag — WIP architectures show a CLI warning and abort generation
- `getArchitectureById()` lookup helper

#### Screaming Architecture (`src/architectures/screaming/`) ✅ Complete
- Full templates for **React**, **Vue 3**, **Svelte**, and **Angular**
- Structure: `components/`, `hooks/` (or `composables/` / `stores/`), `services/`, `types/`, `index.ts`
- Includes login and register forms, service layer, and typed state management for each framework

#### MVVM Architecture (`src/architectures/mvvm/`) ✅ Complete
- Full templates for **React**, **Vue 3**, **Svelte**, and **Angular**
- Three-layer structure per feature: `domain/` → `infrastructure/` → `presentation/`
  - `domain/models/` — pure TypeScript domain entities
  - `domain/repositories/` — repository contract interfaces
  - `domain/errors/` — typed domain error hierarchy (`DomainError`, `AuthenticationError`, `NotFoundError`, `ValidationError`)
  - `infrastructure/api/` — typed `HttpClient` wrapper
  - `infrastructure/dtos/` — Data Transfer Objects for backend mapping
  - `infrastructure/repositories/` — concrete repository implementations
  - `presentation/viewModels/` — state management and use-case orchestration
  - `presentation/views/` — UI components bound to the ViewModel
- React: custom hook ViewModel (`use<Feat>ViewModel`) with `useState` + `useCallback`
- Vue: `ref`/`readonly` based ViewModel composable
- Svelte: `writable` store ViewModel
- Angular: `BehaviorSubject`-based ViewModel service + `Observable` repository contract
- Automatic route injection into `Router.tsx` when React + MVVM is selected

#### MVC Architecture (`src/architectures/mvc/`) 🚧 WIP
- Stub registered — throws a descriptive error if `generate()` is called
- Templates not yet implemented (see CONTRIBUTING.md)

#### Build & Tooling
- TypeScript strict mode (`tsconfig.json`) with `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`
- `tsup` for ESM build with `#!/usr/bin/env node` banner
- ESLint with `@typescript-eslint` — `no-explicit-any` as error, `_`-prefix convention for unused params
- Prettier formatting enforced in CI

#### Testing
- Vitest test suite — `tests/architectures.test.ts` and `tests/integration.test.ts`
- Coverage via `v8` provider with thresholds: lines 80%, statements 80%, branches 85%, functions 75%
- Excluded from coverage: `src/index.ts` (entry point), `src/cli.ts` (interactive prompts), `src/types.ts` (interfaces only)
- Tests cover: architecture registry, framework registry, `screamingArchitecture` (all frameworks), `mvvmArchitecture` (all frameworks, all three layers), `detectExistingProject`, `injectReactFeatureRoutes`, `scaffoldProject`, `runGenerator`, `previewGenerator`, WIP architecture error throwing

#### CI/CD
- `ci.yml` — runs on every PR; matrix across Node 18, 20, 22; runs typecheck, lint, tests
- `publish.yml` — triggers on `v*` tags; runs full checks, publishes to npm with provenance, creates GitHub Release with auto-generated notes
- GitHub issue templates (bug report, feature request)
- Pull Request template with architecture/framework checklists

---

<!-- Template for future releases:

## [0.2.0] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Removed
- ...

-->

[Unreleased]: https://github.com/FabricioPRZ/framearch/compare/HEAD