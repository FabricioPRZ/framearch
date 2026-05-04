# Contributing to framearch

Thank you for wanting to contribute! This guide covers everything you need to add frameworks, implement architectures, fix bugs, or improve the CLI.

---

## Table of contents

1. [Setup](#setup)
2. [Project structure](#project-structure)
3. [Adding a new architecture](#adding-a-new-architecture)
4. [Adding a new framework](#adding-a-new-framework)
5. [Implementing the MVC architecture](#implementing-the-mvc-architecture)
6. [Running tests](#running-tests)
7. [Code style](#code-style)
8. [Commit conventions](#commit-conventions)
9. [Branch conventions](#branch-conventions)
10. [Releasing a new version](#releasing-a-new-version)

---

## Setup

You need **Node 18+** and **npm**.

```bash
git clone https://github.com/FabricioPRZ/framearch.git
cd framearch
npm install
npm run build
```

To test the CLI locally:

```bash
node dist/index.js
```

---

## Project structure

```
framearch/
├── src/
│   ├── types.ts                     # Core interfaces (Framework, Architecture, FileTemplate)
│   ├── cli.ts                       # Interactive prompts & orchestration
│   ├── generator.ts                 # Writes FileTemplates to disk (runGenerator / previewGenerator)
│   ├── scaffold.ts                  # Generates a full project from scratch (scaffoldProject)
│   ├── detector.ts                  # Detects existing framework from package.json
│   ├── featureRoutes.ts             # Injects React routes into Router.tsx
│   ├── frameworks/
│   │   └── index.ts                 # Framework registry — add new frameworks here
│   └── architectures/
│       ├── index.ts                 # Architecture registry — add new architectures here
│       ├── screaming/index.ts       # ✅ Complete — React, Vue, Svelte, Angular
│       ├── mvvm/index.ts            # ✅ Complete — React, Vue, Svelte, Angular
│       └── mvc/index.ts             # 🚧 WIP — templates not yet implemented
├── tests/
│   ├── architectures.test.ts        # Unit tests for architecture & framework registries
│   └── integration.test.ts          # Integration tests for detector, scaffold, generator
└── .github/
    ├── workflows/
    │   ├── ci.yml                   # Runs on every PR (Node 18, 20, 22)
    │   └── publish.yml              # Runs on every v* tag push → publishes to npm
    └── ISSUE_TEMPLATE/
```

---

## Adding a new architecture

This is the main way to contribute to framearch. When a user picks your architecture, they receive real, working code — not placeholders. Write the templates as you would write the actual feature.

### 1 — Create the folder and implement `generate()`

```bash
mkdir src/architectures/my-arch
touch src/architectures/my-arch/index.ts
```

Your file must export an object implementing the [`Architecture`](src/types.ts) interface:

```ts
import type { Architecture, FileTemplate, GenerateContext } from "../../types.js";

function generate(ctx: GenerateContext): FileTemplate[] {
  const { featureName, framework } = ctx;
  const feat = featureName;                                  // e.g. "auth"
  const Feat = feat.charAt(0).toUpperCase() + feat.slice(1); // "Auth"
  const base = `src/my-convention/${feat}`;

  // Branch on framework.id to return framework-specific content
  if (framework.id === "react") {
    return [
      {
        path: `${base}/MyFile.tsx`,
        content: `// real code here — this is what the user will receive\n`,
      },
    ];
  }

  // handle vue, svelte, angular...
  return [];
}

export const myArchitecture: Architecture = {
  id: "my-arch",           // unique kebab-case identifier
  name: "My Architecture",
  description: "One sentence explanation",
  folderConvention: "src/{...}/<feature>/",
  generate,
};
```

> 📌 See `src/architectures/screaming/index.ts` or `src/architectures/mvvm/index.ts` for complete reference implementations covering all four frameworks.

**Important:** if your `generate()` receives a framework you haven't implemented yet, throw a clear error rather than returning empty files:

```ts
throw new Error(
  `My Architecture does not support ${framework.name} yet. ` +
    "See CONTRIBUTING.md to add support.",
);
```

If a parameter is intentionally unused, prefix it with `_` to satisfy the TypeScript strict config:

```ts
// ✅ correct
function genericTemplates(feat: string, Feat: string, base: string, _ext: string): FileTemplate[] {

// ❌ will fail typecheck
function genericTemplates(feat: string, Feat: string, base: string, ext: string): FileTemplate[] {
```

### 2 — Register it

Open `src/architectures/index.ts` and add your architecture:

```ts
import { myArchitecture } from "./my-arch/index.js";

const registry: RegistryEntry[] = [
  { arch: screamingArchitecture },
  { arch: mvvmArchitecture },
  // ...
  { arch: myArchitecture, wip: true }, // remove wip: true when all frameworks are covered
];
```

The `wip: true` flag shows a warning in the CLI and prevents generation. Remove it only when every supported framework has working, non-placeholder templates.

### 3 — Add tests

Add a block in `tests/architectures.test.ts`. At minimum, cover:

```ts
import { myArchitecture } from "../src/architectures/my-arch/index.js";

describe("myArchitecture — all frameworks", () => {
  const frameworks = FRAMEWORKS.filter((f) =>
    ["react", "vue", "svelte", "angular"].includes(f.id),
  );

  for (const framework of frameworks) {
    it(`generates valid templates for ${framework.name}`, () => {
      const templates = myArchitecture.generate({
        featureName: "auth",
        framework,
        outputDir: "/tmp/test",
      });

      expect(templates.length).toBeGreaterThan(0);

      for (const t of templates) {
        expect(typeof t.path).toBe("string");
        expect(t.path.length).toBeGreaterThan(0);
        expect(typeof t.content).toBe("string");
        expect(t.content.length).toBeGreaterThan(0);
      }
    });

    it(`${framework.name}: index.ts contains an export`, () => {
      const templates = myArchitecture.generate({
        featureName: "auth",
        framework,
        outputDir: "/tmp/test",
      });

      const index = templates.find((t) => t.path.endsWith("index.ts"));
      expect(index).toBeDefined();
      expect(index!.content).toContain("export");
    });
  }
});
```

Add more assertions for any structural requirements specific to your architecture (e.g. required subfolders, naming conventions).

### 4 — Update docs

- Add your architecture to the **Supported architectures** table in `README.md`.
- Add an entry to `CHANGELOG.md` under `[Unreleased] → Added`.

---

## Adding a new framework

### 1 — Add to the registry

Open `src/frameworks/index.ts` and append a new entry before the closing comment:

```ts
{
  id: "solid",
  name: "Solid",
  description: "SolidJS with TypeScript",
  fileExtension: "tsx",
  testExtension: "test.tsx",
  supportsJsx: true,
},
```

### 2 — Add templates to every stable architecture

For each architecture where `wip` is **not** set (currently `screaming` and `mvvm`), open its `index.ts` and add a case for your framework id inside the `builders` map or equivalent branching logic.

```ts
// inside screaming/index.ts and mvvm/index.ts
const builders: Record<string, () => FileTemplate[]> = {
  react: () => reactTemplates(feat, Feat, base),
  vue: () => vueTemplates(feat, Feat, base),
  svelte: () => svelteTemplates(feat, Feat, base),
  angular: () => angularTemplates(feat, Feat, base),
  solid: () => solidTemplates(feat, Feat, base), // ← add your builder here
};
```

Then implement the corresponding `solidTemplates()` function following the same pattern as the other framework builders in that file.

### 3 — Update docs

- Add your framework to the **Supported frameworks** table in `README.md`.
- Add an entry to `CHANGELOG.md` under `[Unreleased] → Added`.

---

## Implementing the MVC architecture

`src/architectures/mvc/index.ts` is the open contribution most needed right now. The `generate()` function currently throws — your task is to replace that with real working templates.

**Expected folder convention:**

```
src/features/<feature>/
  models/      → Data shapes and domain logic
  views/       → UI components
  controllers/ → Orchestrates model ↔ view interaction
  index.ts     → Public API barrel
```

**Checklist before opening a PR:**

- [ ] Templates implemented for all four frameworks (React, Vue 3, Svelte, Angular)
- [ ] `wip: true` removed from the registry entry in `src/architectures/index.ts`
- [ ] Tests added to `tests/architectures.test.ts` covering all frameworks
- [ ] `CHANGELOG.md` updated
- [ ] `README.md` architecture table updated

Use `src/architectures/screaming/index.ts` as your structural reference. The screaming architecture is the most straightforward starting point because its templates map closely to MVC's own separation of concerns.

---

## Running tests

```bash
npm test                  # run all tests once
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report
npm run typecheck         # TypeScript only
npm run lint              # ESLint
npm run format:check      # Prettier check
npx prettier --write "src/**/*.ts" "tests/**/*.ts"  # auto-fix formatting
```

### Coverage

Coverage is measured with `vitest --coverage`. The following files are excluded because they have no executable logic or are covered by manual/e2e testing:

| File           | Reason excluded                                  |
| -------------- | ------------------------------------------------ |
| `src/types.ts` | Only TypeScript interfaces, no runtime code      |
| `src/cli.ts`   | Interactive prompts — tested manually or via e2e |
| `src/index.ts` | Single-line entry point that calls `runCli()`    |

Current thresholds:

| Metric     | Threshold |
| ---------- | --------- |
| Lines      | 80%       |
| Statements | 80%       |
| Branches   | 85%       |
| Functions  | 75%       |

PRs that drop below these thresholds will fail CI.

### Lint rules

- `no-console` is **off** globally — the CLI is a console application.
- `@typescript-eslint/no-unused-vars` is set to `error`. Prefix intentionally unused parameters with `_` (e.g. `_ext`).
- `@typescript-eslint/no-explicit-any` is set to `error` — avoid `any`.

---

## Code style

- **TypeScript strict mode** — no `any`, no implicit returns.
- **ESM only** — always use `.js` extension in imports even for `.ts` source files (TypeScript resolves them at build time).
- **Pure `generate()` functions** — no I/O, no side effects. Return `FileTemplate[]` only.
- **Template content = real code** — write templates as you would write the actual feature. No TODOs, no empty stubs.
- Run `npx prettier --write "src/**/*.ts" "tests/**/*.ts"` before committing to avoid format check failures in CI.

---

## Commit conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix      | When to use                                     |
| ----------- | ----------------------------------------------- |
| `feat:`     | New framework, architecture, or CLI feature     |
| `fix:`      | Bug fix                                         |
| `docs:`     | README, CONTRIBUTING, CHANGELOG, comments       |
| `test:`     | Adding or fixing tests                          |
| `style:`    | Formatting only (prettier, whitespace)          |
| `refactor:` | Internal restructuring without behaviour change |
| `chore:`    | Tooling, deps, CI                               |

Examples:

```
feat(arch): implement MVC architecture for React and Vue
feat(framework): add SolidJS support to screaming and mvvm architectures
fix(mvvm): correct Angular repository injection token
docs: update CONTRIBUTING with MVC implementation guide
test(mvvm): add Svelte layer structure assertions
style: apply prettier formatting to mvc/index.ts
chore: bump vitest to 1.6.0
```

---

## Branch conventions

Use: `[type]/[issue]-[short-description]`

Examples:

- `feat/55-mvc-react-templates`
- `feat/62-solid-framework-support`
- `fix/89-mvvm-angular-injection`
- `docs/14-update-contributing`

Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

---

## Releasing a new version

Maintainers only:

```bash
# 1. Bump version in package.json
npm version patch   # or minor / major

# 2. Update CHANGELOG.md — move [Unreleased] items under the new version heading

# 3. Push — publish.yml handles the rest
git push --follow-tags
```

The `publish.yml` workflow will:

- Run all checks (typecheck, lint, test, build)
- Publish to npm with provenance (`NPM_TOKEN` secret required)
- Create a GitHub Release with auto-generated notes

---

If you have questions, open a Discussion or ping the team in the relevant issue. 🙌