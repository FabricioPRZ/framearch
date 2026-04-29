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

You'll be guided through three choices:

1. **Feature name** — e.g. `auth`, `user-profile`, `checkout`
2. **Framework** — React, Vue 3, Svelte, Angular
3. **Architecture** — Screaming Architecture, MVC, MVVM, …

Then framearch generates a complete, typed, ready-to-wire feature folder.

---

## Supported frameworks

| ID | Name | File extension |
|----|------|---------------|
| `react` | React (TypeScript) | `.tsx` |
| `vue` | Vue 3 + Composition API | `.vue` |
| `svelte` | Svelte | `.svelte` |
| `angular` | Angular | `.ts` |

---

## Supported architectures

| ID | Name | Status | Folder convention |
|----|------|--------|------------------|
| `screaming` | Screaming Architecture | ✅ Stable | `src/features/<feat>/{components, hooks, services, types}` |
| `mvc` | MVC | 🚧 WIP | `src/{models, views, controllers}/<feat>/` |
| `mvvm` | MVVM | 🚧 WIP (React only) | `src/features/<feat>/{models, services, viewModels, views}/` |

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

## Dry-run mode

Not sure what will be created? Run with dry-run — the CLI will ask before writing anything:

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

## Contributing

Want to add a new framework or architecture? See **[CONTRIBUTING.md](CONTRIBUTING.md)** — it walks through every step, including how to implement `generate()` and what tests are required.

### TL;DR for new architectures

```bash
# 1. Create your architecture folder
mkdir src/architectures/my-arch
# 2. Implement Architecture interface (see types.ts)
# 3. Register in src/architectures/index.ts
# 4. Add tests in tests/architectures.test.ts
# 5. Open a PR using the template
```

---

## Development

```bash
pnpm install
pnpm build       # compile TypeScript
pnpm test        # run tests
pnpm test:watch  # watch mode
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
