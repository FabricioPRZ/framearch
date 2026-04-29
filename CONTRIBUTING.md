# Contributing to framearch

Thank you for wanting to contribute! This guide explains everything you need to know to add frameworks, architectures, fix bugs, or improve the CLI.

---

## Table of contents

1. [Setup](#setup)
2. [Project structure](#project-structure)
3. [Adding a new architecture](#adding-a-new-architecture)
4. [Adding a new framework](#adding-a-new-framework)
5. [Running tests](#running-tests)
6. [Code style](#code-style)
7. [Commit conventions](#commit-conventions)
8. ⁠⁠[Branch conventions](#branch-conventions)
9. [Releasing a new version](#releasing-a-new-version)

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
│   ├── generator.ts                 # Writes FileTemplates to disk
│   ├── frameworks/
│   │   └── index.ts                 # Framework registry — add new frameworks here
│   └── architectures/
│       ├── index.ts                 # Architecture registry — add new architectures here
│       ├── screaming/index.ts       # ✅ Full reference implementation
│       ├── mvc/index.ts             # 🚧 WIP stub
│       └── mvvm/index.ts            # 🚧 WIP stub
├── tests/
│   ├── generator.test.ts
│   └── architectures.test.ts
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
  const feat = featureName;          // e.g. "auth"
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
  id: "my-arch",            // unique kebab-case identifier
  name: "My Architecture",
  description: "One sentence explanation",
  folderConvention: "src/{...}/<feature>/",
  generate,
};
```

> 📌 See `src/architectures/screaming/index.ts` for a complete reference. It covers React, Vue, Svelte, and Angular with real, working auth code for each.

**Important:** if your `generate()` receives a framework you haven't implemented yet, throw a clear error rather than returning empty files:

```ts
throw new Error(
  `My Architecture does not support ${framework.name} yet. ` +
  "See CONTRIBUTING.md to add support."
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
  // ...
  { arch: myArchitecture, wip: true }, // remove wip: true when all frameworks are covered
];
```

The `wip: true` flag shows a warning in the CLI and prevents generation. Remove it only when all supported frameworks have working templates.

### 3 — Add tests

Add a block in `tests/architectures.test.ts`:

```ts
import { myArchitecture } from "../src/architectures/my-arch/index.js";

describe("myArchitecture", () => {
  it("generates valid templates for React", () => {
    const templates = myArchitecture.generate({
      featureName: "auth",
      framework: FRAMEWORKS.find((f) => f.id === "react")!,
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

  it("index.ts contains an export", () => {
    const templates = myArchitecture.generate({
      featureName: "auth",
      framework: FRAMEWORKS.find((f) => f.id === "react")!,
      outputDir: "/tmp/test",
    });

    const index = templates.find((t) => t.path.endsWith("index.ts"));
    expect(index).toBeDefined();
    expect(index!.content).toContain("export");
  });
});
```

### 4 — Update the README

Add your architecture to the **Supported architectures** table in `README.md`.

---

## Adding a new framework

### 1 — Add to the registry

Open `src/frameworks/index.ts` and append:

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

For each architecture where `wip` is **not** set (currently `screaming`), open its `index.ts` and add a case for your framework id inside the `builders` map or equivalent branching logic.

### 3 — Update the README

Add your framework to the **Supported frameworks** table in `README.md`.

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

| File | Reason excluded |
|------|----------------|
| `src/types.ts` | Only TypeScript interfaces, no runtime code |
| `src/cli.ts` | Interactive prompts — tested manually or via e2e |
| `src/index.ts` | Single-line entry point that calls `runCli()` |

Current thresholds:

| Metric | Threshold |
|--------|-----------|
| Lines | 80% |
| Statements | 80% |
| Branches | 85% |
| Functions | 75% |

PRs that drop below these thresholds will fail CI.

### Lint rules

- `no-console` is **off** globally — the CLI is a console application.
- `@typescript-eslint/no-unused-vars` is set to `error`. Prefix intentionally unused parameters with `_` (e.g. `_ext`).
- `@typescript-eslint/no-explicit-any` is set to `error` — avoid `any`.

---

## Code style

- **TypeScript strict mode** — no `any`, no implicit returns.
- **ESM only** — always use `.js` extension in imports even for `.ts` files (TypeScript resolves them at build time).
- **Pure `generate()` functions** — no I/O, no side effects. Return `FileTemplate[]` only.
- Run `npx prettier --write "src/**/*.ts" "tests/**/*.ts"` before committing to avoid format check failures in CI.

---

## Commit conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
|--------|-------------|
| `feat:` | New framework, architecture, or CLI feature |
| `fix:` | Bug fix |
| `docs:` | README, CONTRIBUTING, comments |
| `test:` | Adding or fixing tests |
| `style:` | Formatting only (prettier, whitespace) |
| `refactor:` | Internal restructuring without behaviour change |
| `chore:` | Tooling, deps, CI |

Examples:

```
feat(arch): add MVC architecture with React and Vue templates
fix(screaming): prefix unused _ext parameter to satisfy strict TS
style: apply prettier formatting to screaming index
test: exclude cli.ts from coverage, adjust thresholds
```

---

## Branch conventions
Use: `[type]/[issue]-[description]`  

Examples:  
- `feat/55-user-registration`  
- `fix/89-mobile-responsive-header`  

Alllowed types:  
`feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

## Releasing a new version

Maintainers only:

```bash
# 1. Bump version in package.json
npm version patch   # or minor / major

# 2. Update CHANGELOG.md

# 3. Push — publish.yml handles the rest
git push --follow-tags
```

The `publish.yml` workflow will:
- Run all checks (typecheck, test, build)
- Publish to npm with provenance (`NPM_TOKEN` secret required)
- Create a GitHub Release with auto-generated notes

---

If you have questions, open a Discussion or ping the team in the relevant issue. 🙌
