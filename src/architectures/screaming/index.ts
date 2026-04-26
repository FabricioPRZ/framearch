import type { Architecture, FileTemplate, GenerateContext } from "../../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Screaming Architecture
//
// The folder structure "screams" the domain (feature) name.
// Every feature is self-contained under src/features/<featureName>/.
//
// Convention:
//   src/features/<featureName>/
//     components/   → UI components specific to this feature
//     hooks/        → React hooks (or composables / stores for other frameworks)
//     services/     → Business logic & API calls
//     types/        → TypeScript types & interfaces
//     index.ts      → Public API — only export what consumers need
// ─────────────────────────────────────────────────────────────────────────────

function generate(ctx: GenerateContext): FileTemplate[] {
  const { featureName, framework } = ctx;
  const feat = featureName; // e.g. "auth"
  const Feat = feat.charAt(0).toUpperCase() + feat.slice(1); // "Auth"
  const base = `src/features/${feat}`;
  const ext = framework.fileExtension;

  // Each framework gets its own template builder
  const builders: Record<string, () => FileTemplate[]> = {
    react: () => reactTemplates(feat, Feat, base),
    vue: () => vueTemplates(feat, Feat, base),
    svelte: () => svelteTemplates(feat, Feat, base),
    angular: () => angularTemplates(feat, Feat, base),
  };

  const builder = builders[framework.id];
  if (!builder) {
    // Fallback: generic TS templates
    return genericTemplates(feat, Feat, base, ext);
  }

  return builder();
}

// ── React ────────────────────────────────────────────────────────────────────

function reactTemplates(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
    {
      path: `${base}/types/${feat}.types.ts`,
      content: `// Types for the ${Feat} feature

export interface ${Feat}User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginCredentials {
  name: string;
}

export interface ${Feat}State {
  user: ${Feat}User | null;
  isLoading: boolean;
  error: string | null;
}

export interface ${Feat}Service {
  login(credentials: LoginCredentials): Promise<${Feat}User>;
  register(payload: RegisterPayload): Promise<${Feat}User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<${Feat}User | null>;
}
`,
    },
    {
      path: `${base}/services/${feat}Service.ts`,
      content: `import type { ${Feat}Service, ${Feat}User, LoginCredentials, RegisterPayload } from "../types/${feat}.types.js";

// ── Replace with your actual API client (axios, fetch, etc.) ──────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const ${feat}Service: ${Feat}Service = {
  async login({ email, password }: LoginCredentials): Promise<${Feat}User> {
    const res = await fetch(\`\${API_BASE}/${feat}/login\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: "Login failed" }));
      throw new Error(message);
    }

    return res.json() as Promise<${Feat}User>;
  },

  async register(payload: RegisterPayload): Promise<${Feat}User> {
    const res = await fetch(\`\${API_BASE}/${feat}/register\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: "Registration failed" }));
      throw new Error(message);
    }

    return res.json() as Promise<${Feat}User>;
  },

  async logout(): Promise<void> {
    await fetch(\`\${API_BASE}/${feat}/logout\`, { method: "POST" });
    localStorage.removeItem("token");
  },

  async getCurrentUser(): Promise<${Feat}User | null> {
    const token = localStorage.getItem("token");
    if (!token) return null;

    const res = await fetch(\`\${API_BASE}/${feat}/me\`, {
      headers: { Authorization: \`Bearer \${token}\` },
    });

    if (!res.ok) return null;
    return res.json() as Promise<${Feat}User>;
  },
};
`,
    },
    {
      path: `${base}/hooks/use${Feat}.ts`,
      content: `import { useState, useEffect, useCallback } from "react";
import type { ${Feat}State, LoginCredentials, RegisterPayload } from "../types/${feat}.types.js";
import { ${feat}Service } from "../services/${feat}Service.js";

export function use${Feat}(): ${Feat}State & {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
} {
  const [state, setState] = useState<${Feat}State>({
    user: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    ${feat}Service
      .getCurrentUser()
      .then((user) => setState({ user, isLoading: false, error: null }))
      .catch(() => setState({ user: null, isLoading: false, error: null }));
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await ${feat}Service.login(credentials);
      setState({ user, isLoading: false, error: null });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      setState((prev) => ({ ...prev, isLoading: false, error }));
      throw err;
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await ${feat}Service.register(payload);
      setState({ user, isLoading: false, error: null });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      setState((prev) => ({ ...prev, isLoading: false, error }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await ${feat}Service.logout();
    setState({ user: null, isLoading: false, error: null });
  }, []);

  return { ...state, login, register, logout };
}
`,
    },
    {
      path: `${base}/components/Login${Feat}Form.tsx`,
      content: `import { useState, type FormEvent } from "react";
import { use${Feat} } from "../hooks/use${Feat}.js";

export function Login${Feat}Form(): JSX.Element {
  const { login, isLoading, error } = use${Feat}();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    await login({ email, password });
  }

  return (
    <form onSubmit={handleSubmit} aria-label="${Feat} login form">
      <div>
        <label htmlFor="${feat}-email">Email</label>
        <input
          id="${feat}-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div>
        <label htmlFor="${feat}-password">Password</label>
        <input
          id="${feat}-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      {error && <p role="alert" style={{ color: "red" }}>{error}</p>}

      <button type="submit" disabled={isLoading}>
        {isLoading ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
`,
    },
    {
      path: `${base}/components/Register${Feat}Form.tsx`,
      content: `import { useState, type FormEvent } from "react";
import { use${Feat} } from "../hooks/use${Feat}.js";

export function Register${Feat}Form(): JSX.Element {
  const { register, isLoading, error } = use${Feat}();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    await register({ name, email, password });
  }

  return (
    <form onSubmit={handleSubmit} aria-label="${Feat} registration form">
      <div>
        <label htmlFor="${feat}-name">Name</label>
        <input
          id="${feat}-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
      </div>

      <div>
        <label htmlFor="${feat}-email">Email</label>
        <input
          id="${feat}-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div>
        <label htmlFor="${feat}-password">Password</label>
        <input
          id="${feat}-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
        />
      </div>

      {error && <p role="alert" style={{ color: "red" }}>{error}</p>}

      <button type="submit" disabled={isLoading}>
        {isLoading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
`,
    },
    {
      path: `${base}/index.ts`,
      content: `// Public API for the ${Feat} feature
// Only export what other parts of the app should consume.

export { use${Feat} } from "./hooks/use${Feat}.js";
export { Login${Feat}Form } from "./components/Login${Feat}Form.js";
export { Register${Feat}Form } from "./components/Register${Feat}Form.js";
export type { ${Feat}User, ${Feat}State, LoginCredentials, RegisterPayload } from "./types/${feat}.types.js";
`,
    },
  ];
}

// ── Vue ──────────────────────────────────────────────────────────────────────

function vueTemplates(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
    {
      path: `${base}/types/${feat}.types.ts`,
      content: `export interface ${Feat}User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginCredentials {
  name: string;
}

export interface ${Feat}State {
  user: ${Feat}User | null;
  isLoading: boolean;
  error: string | null;
}
`,
    },
    {
      path: `${base}/composables/use${Feat}.ts`,
      content: `import { ref, readonly } from "vue";
import type { ${Feat}User, ${Feat}State, LoginCredentials, RegisterPayload } from "../types/${feat}.types.js";

const user = ref<${Feat}User | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function use${Feat}(): {
  user: typeof user;
  isLoading: typeof isLoading;
  error: typeof error;
  login: (c: LoginCredentials) => Promise<void>;
  register: (p: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
} {
  async function login(credentials: LoginCredentials): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await fetch(\`\${API_BASE}/${feat}/login\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) throw new Error("Login failed");
      user.value = await res.json();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error";
    } finally {
      isLoading.value = false;
    }
  }

  async function register(payload: RegisterPayload): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await fetch(\`\${API_BASE}/${feat}/register\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Registration failed");
      user.value = await res.json();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error";
    } finally {
      isLoading.value = false;
    }
  }

  async function logout(): Promise<void> {
    await fetch(\`\${API_BASE}/${feat}/logout\`, { method: "POST" });
    user.value = null;
    localStorage.removeItem("token");
  }

  return { user: readonly(user), isLoading: readonly(isLoading), error: readonly(error), login, register, logout };
}
`,
    },
    {
      path: `${base}/components/Login${Feat}Form.vue`,
      content: `<script setup lang="ts">
import { ref } from "vue";
import { use${Feat} } from "../composables/use${Feat}.js";

const { login, isLoading, error } = use${Feat}();
const email = ref("");
const password = ref("");

async function handleSubmit(): Promise<void> {
  await login({ email: email.value, password: password.value });
}
</script>

<template>
  <form @submit.prevent="handleSubmit" aria-label="${Feat} login form">
    <div>
      <label for="${feat}-email">Email</label>
      <input id="${feat}-email" v-model="email" type="email" required autocomplete="email" />
    </div>
    <div>
      <label for="${feat}-password">Password</label>
      <input id="${feat}-password" v-model="password" type="password" required autocomplete="current-password" />
    </div>
    <p v-if="error" role="alert" style="color: red">{{ error }}</p>
    <button type="submit" :disabled="isLoading">
      {{ isLoading ? "Logging in…" : "Log in" }}
    </button>
  </form>
</template>
`,
    },
    {
      path: `${base}/index.ts`,
      content: `export { use${Feat} } from "./composables/use${Feat}.js";
export { default as Login${Feat}Form } from "./components/Login${Feat}Form.vue";
export type { ${Feat}User, ${Feat}State, LoginCredentials, RegisterPayload } from "./types/${feat}.types.js";
`,
    },
  ];
}

// ── Svelte ───────────────────────────────────────────────────────────────────

function svelteTemplates(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
    {
      path: `${base}/types/${feat}.types.ts`,
      content: `export interface ${Feat}User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginCredentials {
  name: string;
}
`,
    },
    {
      path: `${base}/stores/${feat}Store.ts`,
      content: `import { writable } from "svelte/store";
import type { ${Feat}User } from "../types/${feat}.types.js";

export const ${feat}User = writable<${Feat}User | null>(null);
export const ${feat}Loading = writable(false);
export const ${feat}Error = writable<string | null>(null);
`,
    },
    {
      path: `${base}/components/Login${Feat}Form.svelte`,
      content: `<script lang="ts">
  import { ${feat}User, ${feat}Loading, ${feat}Error } from "../stores/${feat}Store.js";
  import type { LoginCredentials } from "../types/${feat}.types.js";

  let email = "";
  let password = "";

  const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

  async function handleSubmit(): Promise<void> {
    $${feat}Loading = true;
    $${feat}Error = null;
    try {
      const res = await fetch(\`\${API_BASE}/${feat}/login\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password } satisfies LoginCredentials),
      });
      if (!res.ok) throw new Error("Login failed");
      $${feat}User = await res.json();
    } catch (e) {
      $${feat}Error = e instanceof Error ? e.message : "Unknown error";
    } finally {
      $${feat}Loading = false;
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit} aria-label="${Feat} login form">
  <label>
    Email
    <input type="email" bind:value={email} required autocomplete="email" />
  </label>
  <label>
    Password
    <input type="password" bind:value={password} required autocomplete="current-password" />
  </label>
  {#if $${feat}Error}
    <p role="alert" style="color: red">{$${feat}Error}</p>
  {/if}
  <button type="submit" disabled={$${feat}Loading}>
    {$${feat}Loading ? "Logging in…" : "Log in"}
  </button>
</form>
`,
    },
    {
      path: `${base}/index.ts`,
      content: `export { ${feat}User, ${feat}Loading, ${feat}Error } from "./stores/${feat}Store.js";
export { default as Login${Feat}Form } from "./components/Login${Feat}Form.svelte";
export type { ${Feat}User, LoginCredentials, RegisterPayload } from "./types/${feat}.types.js";
`,
    },
  ];
}

// ── Angular ──────────────────────────────────────────────────────────────────

function angularTemplates(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
    {
      path: `${base}/types/${feat}.types.ts`,
      content: `export interface ${Feat}User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginCredentials {
  name: string;
}
`,
    },
    {
      path: `${base}/services/${feat}.service.ts`,
      content: `import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable, tap } from "rxjs";
import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../types/${feat}.types.js";

@Injectable({ providedIn: "root" })
export class ${Feat}Service {
  private readonly API = \`\${import.meta.env["VITE_API_URL"] ?? "http://localhost:3000"}/${feat}\`;
  private userSubject = new BehaviorSubject<${Feat}User | null>(null);
  readonly user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(credentials: LoginCredentials): Observable<${Feat}User> {
    return this.http
      .post<${Feat}User>(\`\${this.API}/login\`, credentials)
      .pipe(tap((user) => this.userSubject.next(user)));
  }

  register(payload: RegisterPayload): Observable<${Feat}User> {
    return this.http
      .post<${Feat}User>(\`\${this.API}/register\`, payload)
      .pipe(tap((user) => this.userSubject.next(user)));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(\`\${this.API}/logout\`, {})
      .pipe(tap(() => this.userSubject.next(null)));
  }
}
`,
    },
    {
      path: `${base}/components/login-${feat}-form.component.ts`,
      content: `import { Component } from "@angular/core";
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from "@angular/forms";
import { ${Feat}Service } from "../services/${feat}.service.js";

@Component({
  selector: "app-login-${feat}-form",
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <form [formGroup]="form" (ngSubmit)="submit()" aria-label="${Feat} login form">
      <div>
        <label for="${feat}-email">Email</label>
        <input id="${feat}-email" type="email" formControlName="email" autocomplete="email" />
      </div>
      <div>
        <label for="${feat}-password">Password</label>
        <input id="${feat}-password" type="password" formControlName="password" autocomplete="current-password" />
      </div>
      <p *ngIf="error" role="alert" style="color:red">{{ error }}</p>
      <button type="submit" [disabled]="isLoading">{{ isLoading ? "Logging in…" : "Log in" }}</button>
    </form>
  \`,
})
export class Login${Feat}FormComponent {
  form: FormGroup;
  isLoading = false;
  error: string | null = null;

  constructor(private fb: FormBuilder, private ${feat}Service: ${Feat}Service) {
    this.form = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(8)]],
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.isLoading = true;
    this.error = null;
    this.${feat}Service.login(this.form.value).subscribe({
      next: () => { this.isLoading = false; },
      error: (e: Error) => { this.error = e.message; this.isLoading = false; },
    });
  }
}
`,
    },
    {
      path: `${base}/index.ts`,
      content: `export { ${Feat}Service } from "./services/${feat}.service.js";
export { Login${Feat}FormComponent } from "./components/login-${feat}-form.component.js";
export type { ${Feat}User, LoginCredentials, RegisterPayload } from "./types/${feat}.types.js";
`,
    },
  ];
}

// ── Generic fallback ─────────────────────────────────────────────────────────

function genericTemplates(feat: string, Feat: string, base: string, ext: string): FileTemplate[] {
  return [
    {
      path: `${base}/types/${feat}.types.ts`,
      content: `export interface ${Feat}User {
  id: string;
  email: string;
  name: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
`,
    },
    {
      path: `${base}/services/${feat}Service.ts`,
      content: `// TODO: implement ${feat} service for your framework\n`,
    },
    {
      path: `${base}/index.ts`,
      content: `export type { ${Feat}User, LoginCredentials } from "./types/${feat}.types.js";\n`,
    },
  ];
}

export const screamingArchitecture: Architecture = {
  id: "screaming",
  name: "Screaming Architecture",
  description: "Features are first-class. Folders scream the domain, not the tech.",
  folderConvention:
    "src/features/<feature>/{components, hooks|composables|stores, services, types, index.ts}",
  generate,
};
