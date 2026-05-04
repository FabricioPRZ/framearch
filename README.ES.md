# framearch

> Genera cualquier feature frontend a tu manera — elige el framework, elige la arquitectura y obtén boilerplate listo para producción en segundos.

```
npx framearch
```

---

## ¿Por qué framearch?

Cada equipo tiene su estructura de carpetas preferida y su framework preferido. Configurar una feature consistente e idiomática desde cero lleva tiempo y abre la puerta a que cada desarrollador lo haga diferente.

`framearch` te permite definir los patrones una vez (como plantillas de arquitectura) y generarlos a demanda — así, las nuevas features siempre arrancan con el pie derecho.

---

## Inicio rápido

```bash
# npm
npx framearch

# pnpm
pnpm dlx framearch
```

La CLI te guía por un flujo corto:

1. **Directorio de salida** — dónde escribir los archivos (por defecto `.`)
2. **Detección de proyecto** — framearch lee tu `package.json` y detecta automáticamente el framework, la herramienta de build y si usas TypeScript. Si no encuentra un proyecto existente, ofrece crear uno desde cero.
3. **Nombre de la feature** — p.ej. `auth`, `user-profile`, `checkout`
4. **Arquitectura** — Screaming Architecture, MVVM, MVC (en desarrollo), …
5. **Dry-run** — previsualiza qué archivos se crearían antes de confirmar

Framearch genera una carpeta de feature completa, tipada y lista para conectar.

---

## Frameworks soportados

| ID        | Nombre                  | Extensión de archivo |
| --------- | ----------------------- | -------------------- |
| `react`   | React (TypeScript)      | `.tsx`               |
| `vue`     | Vue 3 + Composition API | `.vue`               |
| `svelte`  | Svelte                  | `.svelte`            |
| `angular` | Angular                 | `.ts`                |

---

## Arquitecturas soportadas

| ID          | Nombre                 | Estado     | Convención de carpetas                                                 |
| ----------- | ---------------------- | ---------- | ---------------------------------------------------------------------- |
| `screaming` | Screaming Architecture | ✅ Estable | `src/features/<feat>/{components, hooks, services, types}`             |
| `mvvm`      | MVVM + Clean Arch      | ✅ Estable | `src/features/<feat>/{domain, infrastructure, presentation}`           |
| `mvc`       | MVC                    | 🚧 WIP    | `src/{models, views, controllers}/<feat>/`                             |

---

## Ejemplo de salida — React + Screaming Architecture

Ejecutando `npx framearch` con feature `auth`, framework `React` y arquitectura `Screaming`:

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
└── index.ts              ← barril público, importar desde aquí
```

El barril exporta únicamente lo que el resto de la app necesita:

```ts
import { useAuth, LoginAuthForm } from "@/features/auth";
```

---

## Ejemplo de salida — React + MVVM

Ejecutando con feature `auth`, framework `React` y arquitectura `MVVM`, se genera una estructura de tres capas:

```
src/features/auth/
├── domain/
│   ├── models/
│   │   └── auth.model.ts               ← entidades de dominio puras
│   ├── repositories/
│   │   └── authRepository.interface.ts ← contrato del repositorio
│   └── errors/
│       └── domain.errors.ts            ← jerarquía de errores tipados
├── infrastructure/
│   ├── api/
│   │   └── httpClient.ts               ← wrapper HTTP tipado
│   ├── dtos/
│   │   └── auth.dto.ts                 ← mapeo backend ↔ dominio
│   └── repositories/
│       └── authRepository.impl.ts      ← implementación concreta
├── presentation/
│   ├── viewModels/
│   │   └── authViewModel.ts            ← estado y orquestación de casos de uso
│   └── views/
│       ├── LoginAuthView.tsx
│       └── RegisterAuthView.tsx
└── index.ts
```

Al usar React + MVVM, framearch también inyecta las rutas de la feature en `src/core/navigation/Router.tsx` de forma automática.

---

## Cómo funciona el scaffolding por framework

Cada framework usa su herramienta de build convencional:

| Framework | Herramienta      | Comando interno              |
| --------- | ---------------- | ----------------------------|
| React     | Vite             | genera archivos directamente |
| Vue 3     | Vite             | genera archivos directamente |
| Svelte    | Vite             | genera archivos directamente |
| Angular   | Angular CLI      | `npx @angular/cli new`       |

Angular usa `ng new` en lugar de Vite para respetar la estructura y el toolchain convencional de Angular. framearch no te pregunta la herramienta de build cuando seleccionas Angular — siempre usa `@angular/cli`.

---

## Modo dry-run

¿No estás seguro de qué se va a crear? La CLI te pregunta antes de escribir nada:

```
? ¿Previsualizar archivos sin escribir? (dry-run) › Yes

Archivos que se crearían:
  + src/features/auth/types/auth.types.ts
  + src/features/auth/services/authService.ts
  + src/features/auth/hooks/useAuth.ts
  + src/features/auth/components/LoginAuthForm.tsx
  + src/features/auth/components/RegisterAuthForm.tsx
  + src/features/auth/index.ts
```

---

## Scaffolding de proyectos

Si framearch no detecta un proyecto existente en el directorio de salida, ofrece crear uno desde cero:

- **React / Vue / Svelte** — genera `package.json`, `vite.config` con el plugin correcto para cada framework, `tsconfig.json`, `index.html`, `.env`, `.gitignore` y el componente raíz. Las dependencias se instalan automáticamente.
- **Angular** — ejecuta `ng new` con `--standalone`, `--routing` y `--style=css`. El proyecto resultante sigue la estructura estándar de Angular CLI.

---

## Contribuir

¿Quieres agregar un nuevo framework o arquitectura? Consulta **[CONTRIBUTING.md](CONTRIBUTING.md)** — explica cada paso: cómo implementar `generate()`, qué tests se requieren, cómo manejar el scaffolding de Angular y cómo agregar un nuevo framework a las arquitecturas existentes.

La contribución más necesaria en este momento es completar las plantillas de la **arquitectura MVC**. Consulta la sección [Implementando la arquitectura MVC](CONTRIBUTING.md#implementing-the-mvc-architecture) para ver el checklist paso a paso.

### TL;DR para nuevas arquitecturas

```bash
# 1. Crea tu carpeta de arquitectura
mkdir src/architectures/my-arch
# 2. Implementa la interfaz Architecture (ver src/types.ts)
# 3. Regístrala en src/architectures/index.ts (con wip: true hasta que esté completa)
# 4. Agrega tests en tests/architectures.test.ts
# 5. Abre un PR usando la plantilla
```

---

## Desarrollo

```bash
pnpm install
pnpm build          # compilar TypeScript
pnpm test           # ejecutar tests
pnpm test:watch     # modo watch
pnpm test:coverage  # con reporte de cobertura
node dist/index.js  # probar la CLI localmente
```

El CI corre en Node 18, 20 y 22 en cada PR.

---

## Publicar una versión

Solo para mantenedores:

```bash
pnpm version patch   # o minor / major
git push --follow-tags
```

El workflow `publish.yml` publica en npm automáticamente y crea un GitHub Release.

---

## Licencia

MIT — ver [LICENSE](LICENSE).