import type { Architecture, FileTemplate, GenerateContext } from "../../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// MVVM + Clean Architecture + Repository Pattern
//
// Convention:
//   src/features/<feature>/
//     domain/
//       models/       → Pure data / domain entities
//       repositories/ → Contract interfaces (abstractions)
//       errors/       → Domain error types
//     infrastructure/
//       api/          → HTTP client wrapper
//       repositories/ → Concrete repository implementations
//       dtos/         → Data Transfer Objects (backend mapping)
//     presentation/
//       viewModels/   → State management & use-case orchestration
//       views/        → UI components (bind to viewModel)
// ─────────────────────────────────────────────────────────────────────────────

function generate(ctx: GenerateContext): FileTemplate[] {
  const { framework } = ctx;
  const feat = ctx.featureName;
  const Feat = feat.charAt(0).toUpperCase() + feat.slice(1);
  const base = `src/features/${feat}`;

  const builders: Record<string, () => FileTemplate[]> = {
    react: () => reactTemplates(feat, Feat, base),
    vue: () => vueTemplates(feat, Feat, base),
    svelte: () => svelteTemplates(feat, Feat, base),
    angular: () => angularTemplates(feat, Feat, base),
  };

  const builder = builders[framework.id];
  if (!builder) {
    return genericTemplates(feat, Feat, base, framework.fileExtension);
  }

  return builder();
}

// ── React ────────────────────────────────────────────────────────────────────

function reactTemplates(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
    // ── Domain Layer ─────────────────────────────────────────────────────────
    {
      path: `${base}/domain/models/${feat}.model.ts`,
      content: `// Domain model for the ${Feat} feature

export interface ${Feat}User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}
`,
    },
    {
      path: `${base}/domain/repositories/${feat}Repository.interface.ts`,
      content: `import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../models/${feat}.model.js";

/**
 * ${Feat} repository contract — defines the operations available
 * for this domain entity. Infrastructure layer must implement this.
 */
export interface I${Feat}Repository {
  login(credentials: LoginCredentials): Promise<${Feat}User>;
  register(payload: RegisterPayload): Promise<${Feat}User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<${Feat}User | null>;
}
`,
    },
    {
      path: `${base}/domain/errors/domain.errors.ts`,
      content: `/** Base error for domain operations */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class AuthenticationError extends DomainError {
  constructor(message: string = "Authentication failed") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string = "Resource not found") {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public readonly field?: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}
`,
    },

    // ── Infrastructure Layer ─────────────────────────────────────────────────
    {
      path: `${base}/infrastructure/api/httpClient.ts`,
      content: `interface HttpClientOptions {
  baseUrl: string;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

export class HttpClient {
  constructor(private options: HttpClientOptions) {}

  private getAuthHeader(): Record<string, string> {
    const token = localStorage.getItem("token");
    return token ? { Authorization: \`Bearer \${token}\` } : {};
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {} } = options;

    const response = await fetch(\`\${this.options.baseUrl}\${endpoint}\`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeader(),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message ?? \`HTTP \${response.status}\`);
    }

    return response.json() as Promise<T>;
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: "POST", body });
  }

  delete(endpoint: string): Promise<void> {
    return this.request(endpoint, { method: "DELETE" }) as Promise<void>;
  }
}
`,
    },
    {
      path: `${base}/infrastructure/dtos/${feat}.dto.ts`,
      content: `// Data Transfer Objects — map backend response to domain models

export interface ${Feat}UserDto {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  created_at: string;
}

export interface LoginResponseDto {
  user: ${Feat}UserDto;
  token: string;
}

export interface RegisterResponseDto {
  user: ${Feat}UserDto;
  token: string;
}

export interface ErrorResponseDto {
  message: string;
  code?: string;
}
`,
    },
    {
      path: `${base}/infrastructure/repositories/${feat}Repository.impl.ts`,
      content: `import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import type { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { AuthenticationError } from "../../domain/errors/domain.errors.js";
import { HttpClient } from "../api/httpClient.js";
import type { LoginResponseDto, RegisterResponseDto } from "../dtos/${feat}.dto.js";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const http = new HttpClient({ baseUrl: API_BASE });

/**
 * Concrete implementation of the ${Feat} repository.
 * Handles API communication, DTO mapping, and token management.
 */
export class ${Feat}RepositoryImpl implements I${Feat}Repository {
  async login(credentials: LoginCredentials): Promise<${Feat}User> {
    const response = await http.post<LoginResponseDto>("/${feat}/login", credentials);
    localStorage.setItem("token", response.token);
    return this.mapUser(response.user);
  }

  async register(payload: RegisterPayload): Promise<${Feat}User> {
    const response = await http.post<RegisterResponseDto>("/${feat}/register", payload);
    localStorage.setItem("token", response.token);
    return this.mapUser(response.user);
  }

  async logout(): Promise<void> {
    await http.delete("/${feat}/logout");
    localStorage.removeItem("token");
  }

  async getCurrentUser(): Promise<${Feat}User | null> {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
      const response = await http.get<LoginResponseDto>("/${feat}/me");
      return this.mapUser(response.user);
    } catch {
      return null;
    }
  }

  private mapUser(dto: { id: string; email: string; name: string; role: "admin" | "user"; created_at: string }): ${Feat}User {
    return {
      id: dto.id,
      email: dto.email,
      name: dto.name,
      role: dto.role,
      createdAt: new Date(dto.created_at),
    };
  }
}

export const ${feat}Repository: I${Feat}Repository = new ${Feat}RepositoryImpl();
`,
    },

    // ── Presentation Layer ───────────────────────────────────────────────────
    {
      path: `${base}/presentation/viewModels/${feat}ViewModel.ts`,
      content: `import { useState, useEffect, useCallback } from "react";
import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import type { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { ${feat}Repository } from "../../infrastructure/repositories/${feat}Repository.impl.js";

export interface ${Feat}ViewModelState {
  user: ${Feat}User | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * ViewModel: orchestrates use cases and manages presentation state.
 * Depends on the repository abstraction, not on implementation details.
 */
export function use${Feat}ViewModel(
  repository: I${Feat}Repository = ${feat}Repository,
): ${Feat}ViewModelState & {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
} {
  const [state, setState] = useState<${Feat}ViewModelState>({
    user: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    repository
      .getCurrentUser()
      .then((user) => setState({ user, isLoading: false, error: null }))
      .catch(() => setState({ user: null, isLoading: false, error: null }));
  }, [repository]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const user = await repository.login(credentials);
        setState({ user, isLoading: false, error: null });
      } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({ ...prev, isLoading: false, error }));
        throw err;
      }
    },
    [repository],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const user = await repository.register(payload);
        setState({ user, isLoading: false, error: null });
      } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({ ...prev, isLoading: false, error }));
        throw err;
      }
    },
    [repository],
  );

  const logout = useCallback(async () => {
    await repository.logout();
    setState({ user: null, isLoading: false, error: null });
  }, [repository]);

  return { ...state, login, register, logout };
}
`,
    },
    {
      path: `${base}/presentation/views/Login${Feat}View.tsx`,
      content: `import { useState, type FormEvent } from "react";
import { use${Feat}ViewModel } from "../viewModels/${feat}ViewModel.js";

export function Login${Feat}View(): JSX.Element {
  const { login, isLoading, error } = use${Feat}ViewModel();
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
      path: `${base}/presentation/views/Register${Feat}View.tsx`,
      content: `import { useState, type FormEvent } from "react";
import { use${Feat}ViewModel } from "../viewModels/${feat}ViewModel.js";

export function Register${Feat}View(): JSX.Element {
  const { register, isLoading, error } = use${Feat}ViewModel();
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
// Only expose what the rest of the app needs to consume.

// ViewModels
export { use${Feat}ViewModel } from "./presentation/viewModels/${feat}ViewModel.js";

// Views
export { Login${Feat}View } from "./presentation/views/Login${Feat}View.js";
export { Register${Feat}View } from "./presentation/views/Register${Feat}View.js";

// Domain (types & interfaces)
export type { ${Feat}User, LoginCredentials, RegisterPayload } from "./domain/models/${feat}.model.js";
export type { I${Feat}Repository } from "./domain/repositories/${feat}Repository.interface.js";

// Infrastructure (if consumers need direct access)
export { ${feat}Repository } from "./infrastructure/repositories/${feat}Repository.impl.js";
`,
    },
  ];
}

// ── Vue ──────────────────────────────────────────────────────────────────────

function vueTemplates(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
    // ── Domain Layer ─────────────────────────────────────────────────────────
    {
      path: `${base}/domain/models/${feat}.model.ts`,
      content: `export interface ${Feat}User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}
`,
    },
    {
      path: `${base}/domain/repositories/${feat}Repository.interface.ts`,
      content: `import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../models/${feat}.model.js";

export interface I${Feat}Repository {
  login(credentials: LoginCredentials): Promise<${Feat}User>;
  register(payload: RegisterPayload): Promise<${Feat}User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<${Feat}User | null>;
}
`,
    },
    {
      path: `${base}/domain/errors/domain.errors.ts`,
      content: `export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class AuthenticationError extends DomainError {
  constructor(message: string = "Authentication failed") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string = "Resource not found") {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}
`,
    },

    // ── Infrastructure Layer ─────────────────────────────────────────────────
    {
      path: `${base}/infrastructure/api/httpClient.ts`,
      content: `const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: \`Bearer \${token}\` } : {};
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
    method,
    headers: { "Content-Type": "application/json", ...getAuthHeader(), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message ?? \`HTTP \${response.status}\`);
  }

  return response.json() as Promise<T>;
}

export const http = {
  get<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: "GET" });
  },
  post<T>(endpoint: string, body: unknown): Promise<T> {
    return request<T>(endpoint, { method: "POST", body });
  },
  delete(endpoint: string): Promise<void> {
    return request(endpoint, { method: "DELETE" }) as Promise<void>;
  },
};
`,
    },
    {
      path: `${base}/infrastructure/dtos/${feat}.dto.ts`,
      content: `export interface ${Feat}UserDto {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  created_at: string;
}

export interface AuthResponseDto {
  user: ${Feat}UserDto;
  token: string;
}
`,
    },
    {
      path: `${base}/infrastructure/repositories/${feat}Repository.impl.ts`,
      content: `import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import type { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { http } from "../api/httpClient.js";
import type { AuthResponseDto } from "../dtos/${feat}.dto.js";

function mapUser(dto: { id: string; email: string; name: string; role: "admin" | "user"; created_at: string }): ${Feat}User {
  return {
    id: dto.id,
    email: dto.email,
    name: dto.name,
    role: dto.role,
    createdAt: new Date(dto.created_at),
  };
}

export const ${feat}Repository: I${Feat}Repository = {
  async login(credentials: LoginCredentials): Promise<${Feat}User> {
    const res = await http.post<AuthResponseDto>("/${feat}/login", credentials);
    localStorage.setItem("token", res.token);
    return mapUser(res.user);
  },

  async register(payload: RegisterPayload): Promise<${Feat}User> {
    const res = await http.post<AuthResponseDto>("/${feat}/register", payload);
    localStorage.setItem("token", res.token);
    return mapUser(res.user);
  },

  async logout(): Promise<void> {
    await http.delete("/${feat}/logout");
    localStorage.removeItem("token");
  },

  async getCurrentUser(): Promise<${Feat}User | null> {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
      const res = await http.get<AuthResponseDto>("/${feat}/me");
      return mapUser(res.user);
    } catch {
      return null;
    }
  },
};
`,
    },

    // ── Presentation Layer ───────────────────────────────────────────────────
    {
      path: `${base}/presentation/viewModels/${feat}ViewModel.ts`,
      content: `import { ref, readonly } from "vue";
import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import type { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { ${feat}Repository } from "../../infrastructure/repositories/${feat}Repository.impl.js";

const user = ref<${Feat}User | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

export function use${Feat}ViewModel(
  repository: I${Feat}Repository = ${feat}Repository,
): {
  user: typeof user;
  isLoading: typeof isLoading;
  error: typeof error;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
} {
  async function login(credentials: LoginCredentials): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      const authUser = await repository.login(credentials);
      user.value = authUser;
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
      const authUser = await repository.register(payload);
      user.value = authUser;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Unknown error";
    } finally {
      isLoading.value = false;
    }
  }

  async function logout(): Promise<void> {
    await repository.logout();
    user.value = null;
  }

  return {
    user: readonly(user),
    isLoading: readonly(isLoading),
    error: readonly(error),
    login,
    register,
    logout,
  };
}
`,
    },
    {
      path: `${base}/presentation/views/Login${Feat}View.vue`,
      content: `<script setup lang="ts">
import { ref } from "vue";
import { use${Feat}ViewModel } from "../viewModels/${feat}ViewModel.js";

const { login, isLoading, error } = use${Feat}ViewModel();
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
      path: `${base}/presentation/views/Register${Feat}View.vue`,
      content: `<script setup lang="ts">
import { ref } from "vue";
import { use${Feat}ViewModel } from "../viewModels/${feat}ViewModel.js";

const { register, isLoading, error } = use${Feat}ViewModel();
const name = ref("");
const email = ref("");
const password = ref("");

async function handleSubmit(): Promise<void> {
  await register({ name: name.value, email: email.value, password: password.value });
}
</script>

<template>
  <form @submit.prevent="handleSubmit" aria-label="${Feat} registration form">
    <div>
      <label for="${feat}-name">Name</label>
      <input id="${feat}-name" v-model="name" type="text" required autocomplete="name" />
    </div>
    <div>
      <label for="${feat}-email">Email</label>
      <input id="${feat}-email" v-model="email" type="email" required autocomplete="email" />
    </div>
    <div>
      <label for="${feat}-password">Password</label>
      <input id="${feat}-password" v-model="password" type="password" required autocomplete="new-password" minlength="8" />
    </div>
    <p v-if="error" role="alert" style="color: red">{{ error }}</p>
    <button type="submit" :disabled="isLoading">
      {{ isLoading ? "Creating account…" : "Create account" }}
    </button>
  </form>
</template>
`,
    },
    {
      path: `${base}/index.ts`,
      content: `// Public API for the ${Feat} feature

export { use${Feat}ViewModel } from "./presentation/viewModels/${feat}ViewModel.js";
export { default as Login${Feat}View } from "./presentation/views/Login${Feat}View.vue";
export { default as Register${Feat}View } from "./presentation/views/Register${Feat}View.vue";
export type { ${Feat}User, LoginCredentials, RegisterPayload } from "./domain/models/${feat}.model.js";
export type { I${Feat}Repository } from "./domain/repositories/${feat}Repository.interface.js";
`,
    },
  ];
}

// ── Svelte ───────────────────────────────────────────────────────────────────

function svelteTemplates(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
    // ── Domain Layer ─────────────────────────────────────────────────────────
    {
      path: `${base}/domain/models/${feat}.model.ts`,
      content: `export interface ${Feat}User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}
`,
    },
    {
      path: `${base}/domain/repositories/${feat}Repository.interface.ts`,
      content: `import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../models/${feat}.model.js";

export interface I${Feat}Repository {
  login(credentials: LoginCredentials): Promise<${Feat}User>;
  register(payload: RegisterPayload): Promise<${Feat}User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<${Feat}User | null>;
}
`,
    },
    {
      path: `${base}/domain/errors/domain.errors.ts`,
      content: `export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class AuthenticationError extends DomainError {
  constructor(message: string = "Authentication failed") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthenticationError";
  }
}
`,
    },

    // ── Infrastructure Layer ─────────────────────────────────────────────────
    {
      path: `${base}/infrastructure/api/httpClient.ts`,
      content: `const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const http = {
  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(\`\${API_BASE}\${endpoint}\`, {
      headers: { Authorization: \`Bearer \${localStorage.getItem("token") ?? ""}\` },
    });
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    return res.json() as Promise<T>;
  },

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const res = await fetch(\`\${API_BASE}\${endpoint}\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    return res.json() as Promise<T>;
  },

  async delete(endpoint: string): Promise<void> {
    await fetch(\`\${API_BASE}\${endpoint}\`, { method: "DELETE" });
  },
};
`,
    },
    {
      path: `${base}/infrastructure/dtos/${feat}.dto.ts`,
      content: `export interface ${Feat}UserDto {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  created_at: string;
}

export interface AuthResponseDto {
  user: ${Feat}UserDto;
  token: string;
}
`,
    },
    {
      path: `${base}/infrastructure/repositories/${feat}Repository.impl.ts`,
      content: `import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import type { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { http } from "../api/httpClient.js";
import type { AuthResponseDto } from "../dtos/${feat}.dto.js";

function mapUser(dto: { id: string; email: string; name: string; role: "admin" | "user"; created_at: string }): ${Feat}User {
  return { id: dto.id, email: dto.email, name: dto.name, role: dto.role, createdAt: new Date(dto.created_at) };
}

export const ${feat}Repository: I${Feat}Repository = {
  async login(credentials: LoginCredentials): Promise<${Feat}User> {
    const res = await http.post<AuthResponseDto>("/${feat}/login", credentials);
    localStorage.setItem("token", res.token);
    return mapUser(res.user);
  },
  async register(payload: RegisterPayload): Promise<${Feat}User> {
    const res = await http.post<AuthResponseDto>("/${feat}/register", payload);
    localStorage.setItem("token", res.token);
    return mapUser(res.user);
  },
  async logout(): Promise<void> {
    await http.delete("/${feat}/logout");
    localStorage.removeItem("token");
  },
  async getCurrentUser(): Promise<${Feat}User | null> {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
      const res = await http.get<AuthResponseDto>("/${feat}/me");
      return mapUser(res.user);
    } catch {
      return null;
    }
  },
};
`,
    },

    // ── Presentation Layer ───────────────────────────────────────────────────
    {
      path: `${base}/presentation/viewModels/${feat}ViewModel.ts`,
      content: `import { writable } from "svelte/store";
import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import type { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { ${feat}Repository } from "../../infrastructure/repositories/${feat}Repository.impl.js";

export const ${feat}User = writable<${Feat}User | null>(null);
export const ${feat}Loading = writable(false);
export const ${feat}Error = writable<string | null>(null);

export async function loginViewModel(
  credentials: LoginCredentials,
  repository: I${Feat}Repository = ${feat}Repository,
): Promise<void> {
  $${feat}Loading = true;
  $${feat}Error = null;
  try {
    const user = await repository.login(credentials);
    $${feat}User = user;
  } catch (e) {
    $${feat}Error = e instanceof Error ? e.message : "Unknown error";
  } finally {
    $${feat}Loading = false;
  }
}

export async function registerViewModel(
  payload: RegisterPayload,
  repository: I${Feat}Repository = ${feat}Repository,
): Promise<void> {
  $${feat}Loading = true;
  $${feat}Error = null;
  try {
    const user = await repository.register(payload);
    $${feat}User = user;
  } catch (e) {
    $${feat}Error = e instanceof Error ? e.message : "Unknown error";
  } finally {
    $${feat}Loading = false;
  }
}

export async function logoutViewModel(
  repository: I${Feat}Repository = ${feat}Repository,
): Promise<void> {
  await repository.logout();
  $${feat}User = null;
}
`,
    },
    {
      path: `${base}/presentation/views/Login${Feat}View.svelte`,
      content: `<script lang="ts">
  import { ${feat}User, ${feat}Loading, ${feat}Error, loginViewModel } from "../viewModels/${feat}ViewModel.js";
  import type { LoginCredentials } from "../../domain/models/${feat}.model.js";

  let email = "";
  let password = "";

  async function handleSubmit(): Promise<void> {
    await loginViewModel({ email, password } satisfies LoginCredentials);
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
      path: `${base}/presentation/views/Register${Feat}View.svelte`,
      content: `<script lang="ts">
  import { ${feat}Loading, ${feat}Error, registerViewModel } from "../viewModels/${feat}ViewModel.js";
  import type { RegisterPayload } from "../../domain/models/${feat}.model.js";

  let name = "";
  let email = "";
  let password = "";

  async function handleSubmit(): Promise<void> {
    await registerViewModel({ name, email, password } satisfies RegisterPayload);
  }
</script>

<form on:submit|preventDefault={handleSubmit} aria-label="${Feat} registration form">
  <label>
    Name
    <input type="text" bind:value={name} required autocomplete="name" />
  </label>
  <label>
    Email
    <input type="email" bind:value={email} required autocomplete="email" />
  </label>
  <label>
    Password
    <input type="password" bind:value={password} required autocomplete="new-password" minlength="8" />
  </label>
  {#if $${feat}Error}
    <p role="alert" style="color: red">{$${feat}Error}</p>
  {/if}
  <button type="submit" disabled={$${feat}Loading}>
    {$${feat}Loading ? "Creating account…" : "Create account"}
  </button>
</form>
`,
    },
    {
      path: `${base}/index.ts`,
      content: `export { ${feat}User, ${feat}Loading, ${feat}Error, loginViewModel, registerViewModel, logoutViewModel } from "./presentation/viewModels/${feat}ViewModel.js";
export { default as Login${Feat}View } from "./presentation/views/Login${Feat}View.svelte";
export { default as Register${Feat}View } from "./presentation/views/Register${Feat}View.svelte";
export type { ${Feat}User, LoginCredentials, RegisterPayload } from "./domain/models/${feat}.model.js";
export type { I${Feat}Repository } from "./domain/repositories/${feat}Repository.interface.js";
`,
    },
  ];
}

// ── Angular ──────────────────────────────────────────────────────────────────

function angularTemplates(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
    // ── Domain Layer ─────────────────────────────────────────────────────────
    {
      path: `${base}/domain/models/${feat}.model.ts`,
      content: `export interface ${Feat}User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}
`,
    },
    {
      path: `${base}/domain/repositories/${feat}Repository.interface.ts`,
      content: `import type { Observable } from "rxjs";
import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../models/${feat}.model.js";

export abstract class I${Feat}Repository {
  abstract login(credentials: LoginCredentials): Observable<${Feat}User>;
  abstract register(payload: RegisterPayload): Observable<${Feat}User>;
  abstract logout(): Observable<void>;
  abstract getCurrentUser(): Observable<${Feat}User | null>;
}
`,
    },
    {
      path: `${base}/domain/errors/domain.errors.ts`,
      content: `export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class AuthenticationError extends DomainError {
  constructor(message: string = "Authentication failed") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthenticationError";
  }
}
`,
    },

    // ── Infrastructure Layer ─────────────────────────────────────────────────
    {
      path: `${base}/infrastructure/api/httpClient.ts`,
      content: `import { Injectable } from "@angular/core";
import { HttpClient as NgHttpClient } from "@angular/common/http";

@Injectable({ providedIn: "root" })
export class ApiClient {
  private readonly baseUrl = import.meta.env["VITE_API_URL"] ?? "http://localhost:3000";

  constructor(private http: NgHttpClient) {}

  get<T>(endpoint: string) {
    return this.http.get<T>(\`\${this.baseUrl}\${endpoint}\`);
  }

  post<T>(endpoint: string, body: unknown) {
    return this.http.post<T>(\`\${this.baseUrl}\${endpoint}\`, body);
  }

  delete(endpoint: string) {
    return this.http.delete(\`\${this.baseUrl}\${endpoint}\`);
  }
}
`,
    },
    {
      path: `${base}/infrastructure/dtos/${feat}.dto.ts`,
      content: `export interface ${Feat}UserDto {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  created_at: string;
}

export interface AuthResponseDto {
  user: ${Feat}UserDto;
  token: string;
}
`,
    },
    {
      path: `${base}/infrastructure/repositories/${feat}Repository.impl.ts`,
      content: `import { Injectable } from "@angular/core";
import { Observable, map, tap, catchError, of } from "rxjs";
import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { ApiClient } from "../api/httpClient.js";
import type { AuthResponseDto } from "../dtos/${feat}.dto.js";

function mapUser(dto: { id: string; email: string; name: string; role: "admin" | "user"; created_at: string }): ${Feat}User {
  return { id: dto.id, email: dto.email, name: dto.name, role: dto.role, createdAt: new Date(dto.created_at) };
}

@Injectable({ providedIn: "root" })
export class ${Feat}RepositoryImpl implements I${Feat}Repository {
  constructor(private api: ApiClient) {}

  login(credentials: LoginCredentials): Observable<${Feat}User> {
    return this.api.post<AuthResponseDto>("/${feat}/login", credentials).pipe(
      tap((res) => localStorage.setItem("token", res.token)),
      map((res) => mapUser(res.user)),
    );
  }

  register(payload: RegisterPayload): Observable<${Feat}User> {
    return this.api.post<AuthResponseDto>("/${feat}/register", payload).pipe(
      tap((res) => localStorage.setItem("token", res.token)),
      map((res) => mapUser(res.user)),
    );
  }

  logout(): Observable<void> {
    return this.api.delete("/${feat}/logout").pipe(
      tap(() => localStorage.removeItem("token")),
    );
  }

  getCurrentUser(): Observable<${Feat}User | null> {
    const token = localStorage.getItem("token");
    if (!token) return of(null);
    return this.api.get<AuthResponseDto>("/${feat}/me").pipe(
      map((res) => mapUser(res.user)),
      catchError(() => of(null)),
    );
  }
}
`,
    },

    // ── Presentation Layer ───────────────────────────────────────────────────
    {
      path: `${base}/presentation/viewModels/${feat}.viewmodel.ts`,
      content: `import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, tap } from "rxjs";
import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { ${Feat}RepositoryImpl } from "../../infrastructure/repositories/${feat}Repository.impl.js";

@Injectable({ providedIn: "root" })
export class ${Feat}ViewModel {
  private userSubject = new BehaviorSubject<${Feat}User | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  readonly user$ = this.userSubject.asObservable();
  readonly isLoading$ = this.loadingSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();

  constructor(private repository: I${Feat}Repository) {}

  init(): void {
    this.repository.getCurrentUser().subscribe({
      next: (user) => {
        this.userSubject.next(user);
        this.loadingSubject.next(false);
      },
      error: () => {
        this.userSubject.next(null);
        this.loadingSubject.next(false);
      },
    });
  }

  login(credentials: LoginCredentials): void {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    this.repository.login(credentials).subscribe({
      next: (user) => {
        this.userSubject.next(user);
        this.loadingSubject.next(false);
      },
      error: (e: Error) => {
        this.errorSubject.next(e.message);
        this.loadingSubject.next(false);
      },
    });
  }

  register(payload: RegisterPayload): void {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    this.repository.register(payload).subscribe({
      next: (user) => {
        this.userSubject.next(user);
        this.loadingSubject.next(false);
      },
      error: (e: Error) => {
        this.errorSubject.next(e.message);
        this.loadingSubject.next(false);
      },
    });
  }

  logout(): void {
    this.repository.logout().subscribe(() => this.userSubject.next(null));
  }
}
`,
    },
    {
      path: `${base}/presentation/views/login-${feat}.view.ts`,
      content: `import { Component } from "@angular/core";
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from "@angular/forms";
import { ${Feat}ViewModel } from "../viewModels/${feat}.viewmodel.js";

@Component({
  selector: "app-login-${feat}",
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
export class Login${Feat}View {
  form: FormGroup;
  isLoading = false;
  error: string | null = null;

  constructor(private fb: FormBuilder, private vm: ${Feat}ViewModel) {
    this.form = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(8)]],
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.isLoading = true;
    this.error = null;
    this.vm.login(this.form.value);
    this.vm.isLoading$.subscribe((loading) => (this.isLoading = loading));
    this.vm.error$.subscribe((err) => (this.error = err));
  }
}
`,
    },
    {
      path: `${base}/presentation/views/register-${feat}.view.ts`,
      content: `import { Component } from "@angular/core";
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from "@angular/forms";
import { ${Feat}ViewModel } from "../viewModels/${feat}.viewmodel.js";

@Component({
  selector: "app-register-${feat}",
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <form [formGroup]="form" (ngSubmit)="submit()" aria-label="${Feat} registration form">
      <div>
        <label for="${feat}-name">Name</label>
        <input id="${feat}-name" type="text" formControlName="name" autocomplete="name" />
      </div>
      <div>
        <label for="${feat}-email">Email</label>
        <input id="${feat}-email" type="email" formControlName="email" autocomplete="email" />
      </div>
      <div>
        <label for="${feat}-password">Password</label>
        <input id="${feat}-password" type="password" formControlName="password" autocomplete="new-password" />
      </div>
      <p *ngIf="error" role="alert" style="color:red">{{ error }}</p>
      <button type="submit" [disabled]="isLoading">{{ isLoading ? "Creating account…" : "Create account" }}</button>
    </form>
  \`,
})
export class Register${Feat}View {
  form: FormGroup;
  isLoading = false;
  error: string | null = null;

  constructor(private fb: FormBuilder, private vm: ${Feat}ViewModel) {
    this.form = this.fb.group({
      name: ["", [Validators.required]],
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(8)]],
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.isLoading = true;
    this.error = null;
    this.vm.register(this.form.value);
    this.vm.isLoading$.subscribe((loading) => (this.isLoading = loading));
    this.vm.error$.subscribe((err) => (this.error = err));
  }
}
`,
    },
    {
      path: `${base}/index.ts`,
      content: `export { ${Feat}ViewModel } from "./presentation/viewModels/${feat}.viewmodel.js";
export { Login${Feat}View } from "./presentation/views/login-${feat}.view.js";
export { Register${Feat}View } from "./presentation/views/register-${feat}.view.js";
export type { ${Feat}User, LoginCredentials, RegisterPayload } from "./domain/models/${feat}.model.js";
export { I${Feat}Repository } from "./domain/repositories/${feat}Repository.interface.js";
export { ${Feat}RepositoryImpl } from "./infrastructure/repositories/${feat}Repository.impl.js";
`,
    },
  ];
}

// ── Generic fallback ─────────────────────────────────────────────────────────

function genericTemplates(feat: string, Feat: string, base: string, _ext: string): FileTemplate[] {
  return [
    {
      path: `${base}/domain/models/${feat}.model.ts`,
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
      path: `${base}/domain/repositories/${feat}Repository.interface.ts`,
      content: `import type { ${Feat}User, LoginCredentials } from "../models/${feat}.model.js";

export interface I${Feat}Repository {
  login(credentials: LoginCredentials): Promise<${Feat}User>;
  getCurrentUser(): Promise<${Feat}User | null>;
}
`,
    },
    {
      path: `${base}/infrastructure/repositories/${feat}Repository.impl.ts`,
      content: `// TODO: implement ${feat} repository\n`,
    },
    {
      path: `${base}/presentation/viewModels/${feat}ViewModel.ts`,
      content: `// TODO: implement ${feat} view model\n`,
    },
    {
      path: `${base}/index.ts`,
      content: `export type { ${Feat}User, LoginCredentials } from "./domain/models/${feat}.model.js";\n`,
    },
  ];
}

export const mvvmArchitecture: Architecture = {
  id: "mvvm",
  name: "MVVM",
  description: "Model-View-ViewModel: reactive bindings between VM and View.",
  folderConvention: "src/features/<Feature>/{domain, infrastructure, presentation}/",
  generate,
};
