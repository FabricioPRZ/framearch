# Contributing to framearch

Thank you for wanting to contribute! This guide covers everything you need to add frameworks, implement architectures, fix bugs, or improve the CLI.

---

## Table of contents

1. [Setup](#setup)
2. [Project structure](#project-structure)
3. [How Angular scaffolding works](#how-angular-scaffolding-works)
4. [Adding a new architecture](#adding-a-new-architecture)
5. [Adding a new framework](#adding-a-new-framework)
6. [Implementing the MVC architecture](#implementing-the-mvc-architecture)
7. [Running tests](#running-tests)
8. [Code style](#code-style)
9. [Commit conventions](#commit-conventions)
10. [Branch conventions](#branch-conventions)
11. [Releasing a new version](#releasing-a-new-version)

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

## How Angular scaffolding works

Angular uses its own CLI (`ng new`) instead of Vite. When a user selects Angular as the framework and no existing project is detected, framearch runs:

```bash
npx @angular/cli@latest new <project-name> --routing --style=css --standalone --skip-git
```

This produces the standard Angular project structure that Angular developers expect. The build tool selection step is skipped entirely for Angular — it always uses `@angular/cli` and `@angular-devkit/build-angular`.

In tests, Angular scaffolding is verified using a mock filesystem (a pre-built directory that simulates `ng new` output) to keep tests fast and avoid network or CLI dependencies in CI.

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
  const feat = featureName;
  const Feat = feat.charAt(0).toUpperCase() + feat.slice(1);
  const base = `src/my-convention/${feat}`;

  if (framework.id === "react") {
    return [
      {
        path: `${base}/MyFile.tsx`,
        content: `// real code here\n`,
      },
    ];
  }

  // handle vue, svelte, angular...
  return [];
}

export const myArchitecture: Architecture = {
  id: "my-arch",
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

### Angular-specific conventions

When writing Angular templates, always follow these rules to avoid runtime errors:

- **`*ngIf` requires `CommonModule`** — standalone components must include `CommonModule` in their `imports[]` array, or use the newer `@if` control flow syntax (Angular 17+).
- **Subscribe in the constructor, not in event handlers** — subscribing to observables inside `submit()` or other methods creates a new subscription on every call. Subscribe once in the constructor and clean up with `ngOnDestroy`:

```ts
import { Component, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";

export class MyComponent implements OnDestroy {
  private subs = new Subscription();

  constructor(private vm: MyViewModel) {
    // ✅ subscribe once
    this.subs.add(this.vm.isLoading$.subscribe((v) => (this.isLoading = v)));
    this.subs.add(this.vm.error$.subscribe((v) => (this.error = v)));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe(); // ✅ prevent memory leaks
  }
}
```

### 2 — Register it

Open `src/architectures/index.ts` and add your architecture:

```ts
import { myArchitecture } from "./my-arch/index.js";

const registry: RegistryEntry[] = [
  { arch: screamingArchitecture },
  { arch: mvvmArchitecture },
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

For Angular templates specifically, also assert that `CommonModule` is present:

```ts
it("Angular: views import CommonModule", () => {
  const templates = myArchitecture.generate({
    featureName: "auth",
    framework: angularFramework,
    outputDir: "/tmp/test",
  });

  const views = templates.filter((t) => t.path.includes("/views/"));
  for (const view of views) {
    expect(view.content).toContain("CommonModule");
  }
});
```

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

For each stable architecture (`screaming` and `mvvm`), open its `index.ts` and add a case for your framework id inside the `builders` map:

```ts
const builders: Record<string, () => FileTemplate[]> = {
  react: () => reactTemplates(feat, Feat, base),
  vue: () => vueTemplates(feat, Feat, base),
  svelte: () => svelteTemplates(feat, Feat, base),
  angular: () => angularTemplates(feat, Feat, base),
  solid: () => solidTemplates(feat, Feat, base), // ← add here
};
```

### 3 — Handle scaffolding

If your framework uses a dedicated CLI for project creation (like Angular uses `ng new`), update `scaffoldProject()` in `src/scaffold.ts` to handle it separately — similar to how Angular is handled with `scaffoldAngularProject()`. Otherwise, add the framework's dependencies to `generatePackageJson()` and its Vite plugin to `generateViteConfig()`.

### 4 — Update docs

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
- [ ] Angular views include `CommonModule` in `imports[]` and use constructor-based subscriptions
- [ ] `wip: true` removed from the registry entry in `src/architectures/index.ts`
- [ ] Tests added to `tests/architectures.test.ts` covering all frameworks
- [ ] `CHANGELOG.md` updated
- [ ] `README.md` architecture table updated

Use `src/architectures/screaming/index.ts` as your structural reference.

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
fix(mvvm): add CommonModule to Angular standalone views
fix(mvvm): move Angular subscriptions to constructor to prevent memory leaks
fix(scaffold): use ng new for Angular instead of Vite
fix(scaffold): add framework plugins to vite.config generation
docs: update CONTRIBUTING with Angular scaffolding guide
test(scaffold): mock ng new output for Angular tests
```

---

## Branch conventions

Use: `[type]/[issue]-[short-description]`

Examples:

- `feat/55-mvc-react-templates`
- `feat/62-solid-framework-support`
- `fix/89-mvvm-angular-injection`
- `fix/91-angular-scaffold-ng-new`
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