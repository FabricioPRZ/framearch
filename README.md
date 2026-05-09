# framearch

> Scaffold any frontend feature, your way — pick the framework, pick the architecture, get production-ready boilerplate in seconds.

```
npx framearch
```

---

## Why framearch?

Every team has a preferred folder structure and a preferred framework. Setting up a consistent, idiomatic feature from scratch takes time and opens the door to drift between developers.

`framearch` lets you define the patterns once (as architecture templates) and generate them on demand — so new features always start on the right foot.

---

## Quick start

```bash
# npm
npx framearch

# pnpm
pnpm dlx framearch
```

The CLI guides you through a short flow:

1. **Output directory** — where to write (defaults to `.`)
2. **Project detection** — framearch reads your `package.json` and auto-detects framework, build tool, and TypeScript. If no project is found, it offers to scaffold one from scratch.
3. **Feature name** — e.g. `auth`, `user-profile`, `checkout`
4. **Architecture** — Screaming Architecture, MVVM, MVC (WIP), …
5. **Dry-run** — preview which files would be created before committing

Then framearch generates a complete, typed, ready-to-wire feature folder.

---

## Supported frameworks

| ID        | Name                    | File extension |
| --------- | ----------------------- | -------------- |
| `react`   | React (TypeScript)      | `.tsx`         |
| `vue`     | Vue 3 + Composition API | `.vue`         |
| `svelte`  | Svelte                  | `.svelte`      |
| `angular` | Angular                 | `.ts`          |

---

## Supported architectures

| ID          | Name                   | Status     | Folder convention                                                      |
| ----------- | ---------------------- | ---------- | ---------------------------------------------------------------------- |
| `screaming` | Screaming Architecture | ✅ Stable  | `src/features/<feat>/{components, hooks, services, types}`             |
| `mvvm`      | MVVM + Clean Arch      | ✅ Stable  | `src/features/<feat>/{domain, infrastructure, presentation}`           |
| `mvc`       | MVC                    | 🚧 WIP    | `src/{models, views, controllers}/<feat>/`                             |

---

## Example output — React + Screaming Architecture

Running `npx framearch` with feature `auth`, framework `React`, and architecture `Screaming` creates:

```
src/features/auth/
├── components/
│   ├── LoginAuthForm.tsx
│   └── RegisterAuthForm.tsx
├── hooks/
│   └── useAuth.ts
├── services/
│   └── authService.ts
├── types/
│   └── auth.types.ts
└── index.ts              ← public barrel, import from here
```

The barrel exports only what the rest of the app needs:

```ts
import { useAuth, LoginAuthForm } from "@/features/auth";
```

---

## Example output — React + MVVM

Running with feature `auth`, framework `React`, and architecture `MVVM` creates a three-layer structure:

```
src/features/auth/
├── domain/
│   ├── models/
│   │   └── auth.model.ts          ← pure domain entities & interfaces
│   ├── repositories/
│   │   └── authRepository.interface.ts  ← repository contract
│   └── errors/
│       └── domain.errors.ts       ← typed error hierarchy
├── infrastructure/
│   ├── api/
│   │   └── httpClient.ts          ← typed HTTP wrapper
│   ├── dtos/
│   │   └── auth.dto.ts            ← backend ↔ domain mapping
│   └── repositories/
│       └── authRepository.impl.ts ← concrete implementation
├── presentation/
│   ├── viewModels/
│   │   └── authViewModel.ts       ← state & use-case orchestration
│   └── views/
│       ├── LoginAuthView.tsx
│       └── RegisterAuthView.tsx
└── index.ts
```

When using React + MVVM, framearch also injects the feature routes into `src/core/navigation/Router.tsx` automatically.

---

## How scaffolding works per framework

Each framework uses its conventional build tool:

| Framework | Tool         | Internal command             |
| --------- | ------------ | ----------------------------|
| React     | Vite         | generates files directly     |
| Vue 3     | Vite         | generates files directly     |
| Svelte    | Vite         | generates files directly     |
| Angular   | Angular CLI  | `npx @angular/cli new`       |

Angular uses `ng new` instead of Vite to respect the standard Angular project structure and toolchain. framearch skips the build tool selection step when Angular is chosen — it always uses `@angular/cli`.

---

## Dry-run mode

Not sure what will be created? The CLI will ask before writing anything:

```
? Preview files without writing? (dry-run) › Yes

Files that would be created:
  + src/features/auth/types/auth.types.ts
  + src/features/auth/services/authService.ts
  + src/features/auth/hooks/useAuth.ts
  + src/features/auth/components/LoginAuthForm.tsx
  + src/features/auth/components/RegisterAuthForm.tsx
  + src/features/auth/index.ts
```

---

## Project scaffolding

If framearch doesn't detect an existing project in the output directory, it offers to scaffold one from scratch:

- **React / Vue / Svelte** — generates `package.json`, `vite.config` with the correct framework plugin, `tsconfig.json`, `index.html`, `.env`, `.gitignore`, and a minimal app entry point. Dependencies are installed automatically.
- **Angular** — runs `ng new` with `--standalone`, `--routing`, and `--style=css`. The resulting project follows the standard Angular CLI structure.

---

## Contributing

Want to add a new framework or architecture? See **[CONTRIBUTING.md](CONTRIBUTING.md)** — it walks through every step, including how to implement `generate()`, what tests are required, how Angular scaffolding works, and how to add a new framework to existing architectures.

The most needed contribution right now is completing the **MVC architecture** templates. See the [Implementing the MVC architecture](CONTRIBUTING.md#implementing-the-mvc-architecture) section for a step-by-step checklist.

### TL;DR for new architectures

```bash
# 1. Create your architecture folder
mkdir src/architectures/my-arch
# 2. Implement the Architecture interface (see src/types.ts)
# 3. Register in src/architectures/index.ts (with wip: true until complete)
# 4. Add tests in tests/architectures.test.ts
# 5. Open a PR using the template
```

---

## Development

```bash
pnpm install
pnpm build          # compile TypeScript
pnpm test           # run tests
pnpm test:watch     # watch mode
pnpm test:coverage  # with coverage report
node dist/index.js  # test CLI locally
```

CI runs on Node 18, 20 and 22 on every PR.

---

## Releasing

Maintainers only:

```bash
pnpm version patch   # or minor / major
git push --follow-tags
```

The `publish.yml` workflow publishes to npm automatically and creates a GitHub Release.

---

## License

MIT — see [LICENSE](LICENSE).