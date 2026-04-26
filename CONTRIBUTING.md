# Contributing to framearch

Thank you for wanting to contribute! This guide explains everything you need to know to add frameworks, architectures, fix bugs, or improve the CLI.

---

## Table of contents

1. [Setup](#setup)
2. [Project structure](#project-structure)
3. [Adding a new architecture](#adding-a-new-architecture)
4. [Adding a new framework](#adding-a-new-framework)
5. [Running tests](#running-tests)
6. [Commit conventions](#commit-conventions)
7. [Releasing a new version](#releasing-a-new-version)
8. [Code style](#code-style)

---

## Setup

You need **Node 18+** and **pnpm**.

```bash
git clone https://github.com/FabricioPRZ/framearch
cd framearch
pnpm install
pnpm build
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
    │   ├── ci.yml                   # Runs on every PR
    │   └── publish.yml              # Runs on every v* tag push
    └── ISSUE_TEMPLATE/
```

---

## Adding a new architecture

### 1 — Create the folder and implement `generate()`

```bash
mkdir src/architectures/my-arch
touch src/architectures/my-arch/index.ts
```

Your file must export an object implementing [`Architecture`](src/types.ts):

```ts
import type { Architecture, FileTemplate, GenerateContext } from "../../types.js";

function generate(ctx: GenerateContext): FileTemplate[] {
  const { featureName, framework, outputDir } = ctx;
  // Return an array of { path, content } objects.
  // path is relative to outputDir.
  // Branch on framework.id for per-framework content.
  return [
    {
      path: `src/my-convention/${featureName}/index.ts`,
      content: `// ${featureName} feature\n`,
    },
  ];
}

export const myArchitecture: Architecture = {
  id: "my-arch",             // unique kebab-case identifier
  name: "My Architecture",
  description: "One sentence explanation",
  folderConvention: "src/{...}/<feature>/",
  generate,
};
```

> 📌 See `src/architectures/screaming/index.ts` for a complete reference — it covers React, Vue, Svelte and Angular.

### 2 — Register it

Open `src/architectures/index.ts` and add:

```ts
import { myArchitecture } from "./my-arch/index.js";

const registry: RegistryEntry[] = [
  { arch: screamingArchitecture },
  // ...
  { arch: myArchitecture, wip: true }, // remove wip: true when all frameworks are covered
];
```

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
    // add more specific assertions
  });
});
```

### 4 — Update the README

Add your architecture to the **Architectures** table in `README.md`.

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

For each architecture where `wip` is **not** set (currently `screaming`), open its `index.ts` and add a case for your framework id inside the `builders` map (or equivalent).

### 3 — Update the README

Add your framework to the **Frameworks** table in `README.md`.

---

## Running tests

```bash
pnpm test              # run all tests once
pnpm test:watch        # watch mode
pnpm test:coverage     # with coverage report
pnpm typecheck         # TypeScript only
pnpm lint              # ESLint
pnpm format:check      # Prettier
```

Coverage thresholds are enforced — PRs that drop below the minimums will fail CI.

---

## Commit conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
|--------|-------------|
| `feat:` | New framework, architecture, or CLI feature |
| `fix:` | Bug fix |
| `docs:` | README, CONTRIBUTING, comments |
| `test:` | Adding or fixing tests |
| `refactor:` | Internal restructuring without behaviour change |
| `chore:` | Tooling, deps, CI |

Examples:
```
feat(arch): add Feature-Sliced Design architecture
fix(screaming): correct Vue composable export path
docs: update contributing guide for framework additions
```

---

## Releasing a new version

Only maintainers release. Steps:

```bash
# 1. Update version in package.json
pnpm version patch   # or minor / major

# 2. Update CHANGELOG.md

# 3. Push the tag — publish.yml does the rest
git push --follow-tags
```

The `publish.yml` workflow will:
- Run all checks
- Publish to npm with provenance
- Create a GitHub Release with auto-generated notes

---

## Code style

- **TypeScript strict mode** — no `any`, no implicit returns
- **ESM only** — always use `.js` extension in imports (TypeScript resolves them)
- **Pure `generate()` functions** — no I/O, no side effects; everything is a `FileTemplate[]`
- Run `pnpm format` before committing

If you have questions, open a Discussion or ping the team in the relevant issue. 🙌
