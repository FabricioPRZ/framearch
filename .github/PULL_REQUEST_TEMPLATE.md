## Description
<!-- What does this PR do? Link the related issue: "Closes #123" -->

Closes #

## Type of change
- [ ] 🐛 Bug fix
- [ ] ✨ New framework
- [ ] 🏛  New architecture
- [ ] ♻️  Refactor / improvement
- [ ] 📝 Docs / comments
- [ ] 🔧 CI / tooling

## Checklist
- [ ] I read `CONTRIBUTING.md` before starting
- [ ] My branch is up to date with `main`
- [ ] `pnpm lint` passes with no new warnings
- [ ] `pnpm test` passes and coverage doesn't drop
- [ ] New code has tests (or I explained in the PR why tests aren't needed)
- [ ] I updated `README.md` / `CHANGELOG.md` where relevant

## For new architectures
<!-- Fill in if this PR adds a new architecture, otherwise delete this section -->
- [ ] Added folder in `src/architectures/<arch>/`
- [ ] Implemented `generate()` for **all** supported frameworks (React, Vue, Svelte, Angular)
- [ ] Registered it in `src/architectures/index.ts` (remove `wip: true` when ready)
- [ ] Added architecture to the `README.md` table
- [ ] Added `architectures.test.ts` test case

## For new frameworks
<!-- Fill in if this PR adds a new framework, otherwise delete this section -->
- [ ] Added entry to `src/frameworks/index.ts`
- [ ] Added framework-specific template to every **stable** (non-WIP) architecture
- [ ] Added framework to the `README.md` table

## Screenshots / demo
<!-- Optional but appreciated for CLI output changes -->
