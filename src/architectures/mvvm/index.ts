import type { Architecture, FileTemplate, GenerateContext, AngularNgStep } from "../../types.js";

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
//       api/          → HTTP client wrapper  ← ng generate service
//       repositories/ → Concrete repository  ← ng generate service
//       dtos/         → Data Transfer Objects (backend mapping)
//     presentation/
//       viewModels/   → State management     ← ng generate service
//       views/        → UI components        ← ng generate component
//
// Angular note:
//   generate()       → writes domain layer, DTOs, and index barrel directly.
//   angularNgSteps() → runs `ng generate` for services/components, then injects
//                       auth logic into the generated .ts files. The .html and
//                       .css files are left empty for the user to style.
// ─────────────────────────────────────────────────────────────────────────────

function generate(ctx: GenerateContext): FileTemplate[] {
  const { framework } = ctx;
  const feat = ctx.featureName;
  const Feat = feat.charAt(0).toUpperCase() + feat.slice(1);

  // Angular files live under src/app/; all other frameworks use src/
  const base =
    framework.id === "angular"
      ? `src/app/features/${feat}`
      : `src/features/${feat}`;

  const builders: Record<string, () => FileTemplate[]> = {
    react: () => reactTemplates(feat, Feat, base),
    vue: () => vueTemplates(feat, Feat, base),
    svelte: () => svelteTemplates(feat, Feat, base),
    // Angular: only direct-write files (domain + DTOs + barrel).
    // Services and components are scaffolded via angularNgSteps().
    angular: () => angularDirectFiles(feat, Feat, base),
  };

  const builder = builders[framework.id];
  if (!builder) {
    return genericTemplates(feat, Feat, base, framework.fileExtension);
  }

  return builder();
}

// ── Angular: direct-write files ───────────────────────────────────────────────
// Only the pure-TypeScript files that have no Angular CLI equivalent.
// Components and services are handled by angularNgSteps() below.

function angularDirectFiles(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
    // ── Domain layer ─────────────────────────────────────────────────────────
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

/**
 * Repository contract for the ${Feat} feature.
 * Using an abstract class instead of an interface so Angular can use it
 * as a DI injection token when needed.
 */
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

    // ── Infrastructure DTOs ───────────────────────────────────────────────────
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

export interface ErrorResponseDto {
  message: string;
  code?: string;
}
`,
    },

    // ── Public barrel ─────────────────────────────────────────────────────────
    {
      path: `${base}/index.ts`,
      content: `// Public API for the ${Feat} feature.
// Only export what the rest of the application needs to consume.

// ViewModel (service)
export { ${Feat}ViewModelService } from "./presentation/view-models/${feat}-view-model.service.js";

// View components
export { Login${Feat}Component } from "./presentation/views/login-${feat}/login-${feat}.component.js";
export { Register${Feat}Component } from "./presentation/views/register-${feat}/register-${feat}.component.js";

// Domain types
export type { ${Feat}User, LoginCredentials, RegisterPayload } from "./domain/models/${feat}.model.js";
export { I${Feat}Repository } from "./domain/repositories/${feat}Repository.interface.js";

// Infrastructure (if consumers need direct access)
export { ${Feat}RepositoryImplService } from "./infrastructure/repositories/${feat}-repository-impl.service.js";
`,
    },
  ];
}

// ── Angular: ng generate steps ────────────────────────────────────────────────

function angularNgStepsGenerator(ctx: GenerateContext): AngularNgStep[] {
  const feat = ctx.featureName;
  const Feat = feat.charAt(0).toUpperCase() + feat.slice(1);
  const base = `src/app/features/${feat}`;

  return [
    // ── 1. HTTP client wrapper ─────────────────────────────────────────────
    {
      ngGenerate: `service features/${feat}/infrastructure/api/${feat}-api --skip-tests`,
      tsPath: `${base}/infrastructure/api/${feat}-api.service.ts`,
      tsContent: `import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";

/** Replace with your real API base URL or inject it via an environment token. */
const API_BASE = "http://localhost:3000";

@Injectable({ providedIn: "root" })
export class ${Feat}ApiService {
  constructor(private http: HttpClient) {}

  private get authHeaders(): HttpHeaders {
    const token = localStorage.getItem("token");
    return token
      ? new HttpHeaders({ Authorization: \`Bearer \${token}\` })
      : new HttpHeaders();
  }

  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(\`\${API_BASE}\${endpoint}\`, { headers: this.authHeaders });
  }

  post<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.post<T>(\`\${API_BASE}\${endpoint}\`, body, { headers: this.authHeaders });
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(\`\${API_BASE}\${endpoint}\`, { headers: this.authHeaders });
  }
}
`,
    },

    // ── 2. Repository implementation ──────────────────────────────────────
    {
      ngGenerate: `service features/${feat}/infrastructure/repositories/${feat}-repository-impl --skip-tests`,
      tsPath: `${base}/infrastructure/repositories/${feat}-repository-impl.service.ts`,
      tsContent: `import { Injectable } from "@angular/core";
import { Observable, map, tap, catchError, of } from "rxjs";
import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { ${Feat}ApiService } from "../api/${feat}-api.service.js";
import type { AuthResponseDto } from "../dtos/${feat}.dto.js";

function mapUser(dto: {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  created_at: string;
}): ${Feat}User {
  return {
    id: dto.id,
    email: dto.email,
    name: dto.name,
    role: dto.role,
    createdAt: new Date(dto.created_at),
  };
}

@Injectable({ providedIn: "root" })
export class ${Feat}RepositoryImplService extends I${Feat}Repository {
  constructor(private api: ${Feat}ApiService) {
    super();
  }

  login(credentials: LoginCredentials): Observable<${Feat}User> {
    return this.api
      .post<AuthResponseDto>("/${feat}/login", credentials)
      .pipe(
        tap((res) => localStorage.setItem("token", res.token)),
        map((res) => mapUser(res.user)),
      );
  }

  register(payload: RegisterPayload): Observable<${Feat}User> {
    return this.api
      .post<AuthResponseDto>("/${feat}/register", payload)
      .pipe(
        tap((res) => localStorage.setItem("token", res.token)),
        map((res) => mapUser(res.user)),
      );
  }

  logout(): Observable<void> {
    return this.api.delete<void>("/${feat}/logout").pipe(
      tap(() => localStorage.removeItem("token")),
    ) as Observable<void>;
  }

  getCurrentUser(): Observable<${Feat}User | null> {
    if (!localStorage.getItem("token")) return of(null);
    return this.api.get<AuthResponseDto>("/${feat}/me").pipe(
      map((res) => mapUser(res.user)),
      catchError(() => of(null)),
    );
  }
}
`,
    },

    // ── 3. ViewModel (service) ─────────────────────────────────────────────
    {
      ngGenerate: `service features/${feat}/presentation/view-models/${feat}-view-model --skip-tests`,
      tsPath: `${base}/presentation/view-models/${feat}-view-model.service.ts`,
      tsContent: `import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import { ${Feat}RepositoryImplService } from "../../infrastructure/repositories/${feat}-repository-impl.service.js";

@Injectable({ providedIn: "root" })
export class ${Feat}ViewModelService {
  private userSubject = new BehaviorSubject<${Feat}User | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  readonly user$ = this.userSubject.asObservable();
  readonly isLoading$ = this.loadingSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();

  constructor(private repository: ${Feat}RepositoryImplService) {}

  /** Call on app start to restore the session if a token exists. */
  init(): void {
    this.loadingSubject.next(true);
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

    // ── 4. Login component ─────────────────────────────────────────────────
    {
      ngGenerate: `component features/${feat}/presentation/views/login-${feat} --standalone --skip-tests`,
      tsPath: `${base}/presentation/views/login-${feat}/login-${feat}.component.ts`,
      tsContent: `import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { ${Feat}ViewModelService } from "../../view-models/${feat}-view-model.service.js";

@Component({
  selector: "app-login-${feat}",
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: "./login-${feat}.component.html",
  styleUrl: "./login-${feat}.component.css",
})
export class Login${Feat}Component implements OnInit, OnDestroy {
  form: FormGroup;
  isLoading = false;
  error: string | null = null;

  private subs = new Subscription();

  constructor(
    private fb: FormBuilder,
    private vm: ${Feat}ViewModelService,
  ) {
    this.form = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(8)]],
    });
  }

  ngOnInit(): void {
    this.subs.add(this.vm.isLoading$.subscribe((v) => (this.isLoading = v)));
    this.subs.add(this.vm.error$.subscribe((v) => (this.error = v)));
  }

  submit(): void {
    if (this.form.invalid) return;
    this.vm.login(this.form.value);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
`,
      // Minimal functional HTML — no CSS classes so the user can apply their own
      htmlPath: `${base}/presentation/views/login-${feat}/login-${feat}.component.html`,
      htmlContent: `<!-- TODO: Add your layout and styles in login-${feat}.component.css -->
<form [formGroup]="form" (ngSubmit)="submit()">
  <div>
    <label for="${feat}-email">Email</label>
    <input
      id="${feat}-email"
      type="email"
      formControlName="email"
      autocomplete="email"
    />
  </div>

  <div>
    <label for="${feat}-password">Password</label>
    <input
      id="${feat}-password"
      type="password"
      formControlName="password"
      autocomplete="current-password"
    />
  </div>

  <p *ngIf="error" role="alert">{{ error }}</p>

  <button type="submit" [disabled]="isLoading">
    {{ isLoading ? "Logging in…" : "Log in" }}
  </button>
</form>
`,
    },

    // ── 5. Register component ──────────────────────────────────────────────
    {
      ngGenerate: `component features/${feat}/presentation/views/register-${feat} --standalone --skip-tests`,
      tsPath: `${base}/presentation/views/register-${feat}/register-${feat}.component.ts`,
      tsContent: `import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { ${Feat}ViewModelService } from "../../view-models/${feat}-view-model.service.js";

@Component({
  selector: "app-register-${feat}",
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: "./register-${feat}.component.html",
  styleUrl: "./register-${feat}.component.css",
})
export class Register${Feat}Component implements OnInit, OnDestroy {
  form: FormGroup;
  isLoading = false;
  error: string | null = null;

  private subs = new Subscription();

  constructor(
    private fb: FormBuilder,
    private vm: ${Feat}ViewModelService,
  ) {
    this.form = this.fb.group({
      name: ["", [Validators.required]],
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(8)]],
    });
  }

  ngOnInit(): void {
    this.subs.add(this.vm.isLoading$.subscribe((v) => (this.isLoading = v)));
    this.subs.add(this.vm.error$.subscribe((v) => (this.error = v)));
  }

  submit(): void {
    if (this.form.invalid) return;
    this.vm.register(this.form.value);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
`,
      // Minimal functional HTML — no CSS classes
      htmlPath: `${base}/presentation/views/register-${feat}/register-${feat}.component.html`,
      htmlContent: `<!-- TODO: Add your layout and styles in register-${feat}.component.css -->
<form [formGroup]="form" (ngSubmit)="submit()">
  <div>
    <label for="${feat}-name">Name</label>
    <input
      id="${feat}-name"
      type="text"
      formControlName="name"
      autocomplete="name"
    />
  </div>

  <div>
    <label for="${feat}-email">Email</label>
    <input
      id="${feat}-email"
      type="email"
      formControlName="email"
      autocomplete="email"
    />
  </div>

  <div>
    <label for="${feat}-password">Password</label>
    <input
      id="${feat}-password"
      type="password"
      formControlName="password"
      autocomplete="new-password"
    />
  </div>

  <p *ngIf="error" role="alert">{{ error }}</p>

  <button type="submit" [disabled]="isLoading">
    {{ isLoading ? "Creating account…" : "Create account" }}
  </button>
</form>
`,
    },
  ];
}

// ── React ─────────────────────────────────────────────────────────────────────

function reactTemplates(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
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

export class ValidationError extends DomainError {
  constructor(message: string, public readonly field?: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}
`,
    },
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
      content: `export interface ${Feat}UserDto {
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
`,
    },
    {
      path: `${base}/infrastructure/repositories/${feat}Repository.impl.ts`,
      content: `import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import type { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { HttpClient } from "../api/httpClient.js";
import type { LoginResponseDto } from "../dtos/${feat}.dto.js";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const http = new HttpClient({ baseUrl: API_BASE });

export class ${Feat}RepositoryImpl implements I${Feat}Repository {
  async login(credentials: LoginCredentials): Promise<${Feat}User> {
    const res = await http.post<LoginResponseDto>("/${feat}/login", credentials);
    localStorage.setItem("token", res.token);
    return this.mapUser(res.user);
  }

  async register(payload: RegisterPayload): Promise<${Feat}User> {
    const res = await http.post<LoginResponseDto>("/${feat}/register", payload);
    localStorage.setItem("token", res.token);
    return this.mapUser(res.user);
  }

  async logout(): Promise<void> {
    await http.delete("/${feat}/logout");
    localStorage.removeItem("token");
  }

  async getCurrentUser(): Promise<${Feat}User | null> {
    if (!localStorage.getItem("token")) return null;
    try {
      const res = await http.get<LoginResponseDto>("/${feat}/me");
      return this.mapUser(res.user);
    } catch {
      return null;
    }
  }

  private mapUser(dto: { id: string; email: string; name: string; role: "admin" | "user"; created_at: string }): ${Feat}User {
    return { id: dto.id, email: dto.email, name: dto.name, role: dto.role, createdAt: new Date(dto.created_at) };
  }
}

export const ${feat}Repository: I${Feat}Repository = new ${Feat}RepositoryImpl();
`,
    },
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
        setState((prev) => ({ ...prev, isLoading: false, error: err instanceof Error ? err.message : "Unknown error" }));
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
        setState((prev) => ({ ...prev, isLoading: false, error: err instanceof Error ? err.message : "Unknown error" }));
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
        <input id="${feat}-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div>
        <label htmlFor="${feat}-password">Password</label>
        <input id="${feat}-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      </div>
      {error && <p role="alert" style={{ color: "red" }}>{error}</p>}
      <button type="submit" disabled={isLoading}>{isLoading ? "Logging in…" : "Log in"}</button>
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
        <input id="${feat}-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
      </div>
      <div>
        <label htmlFor="${feat}-email">Email</label>
        <input id="${feat}-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div>
        <label htmlFor="${feat}-password">Password</label>
        <input id="${feat}-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={8} />
      </div>
      {error && <p role="alert" style={{ color: "red" }}>{error}</p>}
      <button type="submit" disabled={isLoading}>{isLoading ? "Creating account…" : "Create account"}</button>
    </form>
  );
}
`,
    },
    {
      path: `${base}/index.ts`,
      content: `export { use${Feat}ViewModel } from "./presentation/viewModels/${feat}ViewModel.js";
export { Login${Feat}View } from "./presentation/views/Login${Feat}View.js";
export { Register${Feat}View } from "./presentation/views/Register${Feat}View.js";
export type { ${Feat}User, LoginCredentials, RegisterPayload } from "./domain/models/${feat}.model.js";
export type { I${Feat}Repository } from "./domain/repositories/${feat}Repository.interface.js";
export { ${feat}Repository } from "./infrastructure/repositories/${feat}Repository.impl.js";
`,
    },
  ];
}

// ── Vue ───────────────────────────────────────────────────────────────────────

function vueTemplates(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
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
  constructor(message: string, public readonly code: string, public readonly statusCode?: number) {
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
    {
      path: `${base}/infrastructure/api/httpClient.ts`,
      content: `const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: \`Bearer \${token}\` } : {};
}

export async function request<T>(endpoint: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = "GET", body } = options;
  const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
    method,
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message ?? \`HTTP \${response.status}\`);
  }
  return response.json() as Promise<T>;
}

export const http = {
  get<T>(endpoint: string): Promise<T> { return request<T>(endpoint); },
  post<T>(endpoint: string, body: unknown): Promise<T> { return request<T>(endpoint, { method: "POST", body }); },
  delete(endpoint: string): Promise<void> { return request(endpoint, { method: "DELETE" }) as Promise<void>; },
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
    if (!localStorage.getItem("token")) return null;
    try {
      const res = await http.get<AuthResponseDto>("/${feat}/me");
      return mapUser(res.user);
    } catch { return null; }
  },
};
`,
    },
    {
      path: `${base}/presentation/viewModels/${feat}ViewModel.ts`,
      content: `import { ref, readonly } from "vue";
import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import type { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { ${feat}Repository } from "../../infrastructure/repositories/${feat}Repository.impl.js";

const user = ref<${Feat}User | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

export function use${Feat}ViewModel(repository: I${Feat}Repository = ${feat}Repository) {
  async function login(credentials: LoginCredentials): Promise<void> {
    isLoading.value = true; error.value = null;
    try { user.value = await repository.login(credentials); }
    catch (e) { error.value = e instanceof Error ? e.message : "Unknown error"; }
    finally { isLoading.value = false; }
  }

  async function register(payload: RegisterPayload): Promise<void> {
    isLoading.value = true; error.value = null;
    try { user.value = await repository.register(payload); }
    catch (e) { error.value = e instanceof Error ? e.message : "Unknown error"; }
    finally { isLoading.value = false; }
  }

  async function logout(): Promise<void> {
    await repository.logout();
    user.value = null;
  }

  return { user: readonly(user), isLoading: readonly(isLoading), error: readonly(error), login, register, logout };
}
`,
    },
    {
      path: `${base}/presentation/views/Login${Feat}View.vue`,
      content: `<script setup lang="ts">
import { ref } from "vue";
import { use${Feat}ViewModel } from "../viewModels/${feat}ViewModel.js";

const { login, isLoading, error } = use${Feat}ViewModel();
const email = ref(""); const password = ref("");
async function handleSubmit() { await login({ email: email.value, password: password.value }); }
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div><label for="${feat}-email">Email</label><input id="${feat}-email" v-model="email" type="email" required autocomplete="email" /></div>
    <div><label for="${feat}-password">Password</label><input id="${feat}-password" v-model="password" type="password" required autocomplete="current-password" /></div>
    <p v-if="error" role="alert" style="color: red">{{ error }}</p>
    <button type="submit" :disabled="isLoading">{{ isLoading ? "Logging in…" : "Log in" }}</button>
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
const name = ref(""); const email = ref(""); const password = ref("");
async function handleSubmit() { await register({ name: name.value, email: email.value, password: password.value }); }
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div><label for="${feat}-name">Name</label><input id="${feat}-name" v-model="name" type="text" required autocomplete="name" /></div>
    <div><label for="${feat}-email">Email</label><input id="${feat}-email" v-model="email" type="email" required autocomplete="email" /></div>
    <div><label for="${feat}-password">Password</label><input id="${feat}-password" v-model="password" type="password" required autocomplete="new-password" minlength="8" /></div>
    <p v-if="error" role="alert" style="color: red">{{ error }}</p>
    <button type="submit" :disabled="isLoading">{{ isLoading ? "Creating account…" : "Create account" }}</button>
  </form>
</template>
`,
    },
    {
      path: `${base}/index.ts`,
      content: `export { use${Feat}ViewModel } from "./presentation/viewModels/${feat}ViewModel.js";
export { default as Login${Feat}View } from "./presentation/views/Login${Feat}View.vue";
export { default as Register${Feat}View } from "./presentation/views/Register${Feat}View.vue";
export type { ${Feat}User, LoginCredentials, RegisterPayload } from "./domain/models/${feat}.model.js";
export type { I${Feat}Repository } from "./domain/repositories/${feat}Repository.interface.js";
`,
    },
  ];
}

// ── Svelte ────────────────────────────────────────────────────────────────────

function svelteTemplates(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
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
  constructor(message: string, public readonly code: string, public readonly statusCode?: number) {
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
    {
      path: `${base}/infrastructure/api/httpClient.ts`,
      content: `const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const http = {
  async get<T>(endpoint: string): Promise<T> {
    const token = localStorage.getItem("token");
    const res = await fetch(\`\${API_BASE}\${endpoint}\`, { headers: token ? { Authorization: \`Bearer \${token}\` } : {} });
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    return res.json() as Promise<T>;
  },
  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const res = await fetch(\`\${API_BASE}\${endpoint}\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    return res.json() as Promise<T>;
  },
  async delete(endpoint: string): Promise<void> { await fetch(\`\${API_BASE}\${endpoint}\`, { method: "DELETE" }); },
};
`,
    },
    {
      path: `${base}/infrastructure/dtos/${feat}.dto.ts`,
      content: `export interface ${Feat}UserDto { id: string; email: string; name: string; role: "admin" | "user"; created_at: string; }
export interface AuthResponseDto { user: ${Feat}UserDto; token: string; }
`,
    },
    {
      path: `${base}/infrastructure/repositories/${feat}Repository.impl.ts`,
      content: `import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import type { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { http } from "../api/httpClient.js";
import type { AuthResponseDto } from "../dtos/${feat}.dto.js";

const map = (dto: { id: string; email: string; name: string; role: "admin" | "user"; created_at: string }): ${Feat}User =>
  ({ id: dto.id, email: dto.email, name: dto.name, role: dto.role, createdAt: new Date(dto.created_at) });

export const ${feat}Repository: I${Feat}Repository = {
  async login(c: LoginCredentials): Promise<${Feat}User> { const r = await http.post<AuthResponseDto>("/${feat}/login", c); localStorage.setItem("token", r.token); return map(r.user); },
  async register(p: RegisterPayload): Promise<${Feat}User> { const r = await http.post<AuthResponseDto>("/${feat}/register", p); localStorage.setItem("token", r.token); return map(r.user); },
  async logout(): Promise<void> { await http.delete("/${feat}/logout"); localStorage.removeItem("token"); },
  async getCurrentUser(): Promise<${Feat}User | null> { if (!localStorage.getItem("token")) return null; try { const r = await http.get<AuthResponseDto>("/${feat}/me"); return map(r.user); } catch { return null; } },
};
`,
    },
    {
      path: `${base}/presentation/viewModels/${feat}ViewModel.ts`,
      content: `import { writable } from "svelte/store";
import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../../domain/models/${feat}.model.js";
import type { I${Feat}Repository } from "../../domain/repositories/${feat}Repository.interface.js";
import { ${feat}Repository } from "../../infrastructure/repositories/${feat}Repository.impl.js";

export const ${feat}User = writable<${Feat}User | null>(null);
export const ${feat}Loading = writable(false);
export const ${feat}Error = writable<string | null>(null);

async function wrap<T>(repo: I${Feat}Repository, fn: (r: I${Feat}Repository) => Promise<T>): Promise<T> {
  ${feat}Loading.set(true); ${feat}Error.set(null);
  try { return await fn(repo); } catch (e) { ${feat}Error.set(e instanceof Error ? e.message : "Unknown error"); throw e; }
  finally { ${feat}Loading.set(false); }
}

export const loginViewModel = (c: LoginCredentials, r = ${feat}Repository) =>
  wrap(r, async (repo) => { const u = await repo.login(c); ${feat}User.set(u); });

export const registerViewModel = (p: RegisterPayload, r = ${feat}Repository) =>
  wrap(r, async (repo) => { const u = await repo.register(p); ${feat}User.set(u); });

export const logoutViewModel = (r = ${feat}Repository) =>
  r.logout().then(() => ${feat}User.set(null));
`,
    },
    {
      path: `${base}/presentation/views/Login${Feat}View.svelte`,
      content: `<script lang="ts">
  import { ${feat}Loading, ${feat}Error, loginViewModel } from "../viewModels/${feat}ViewModel.js";
  let email = "", password = "";
  const handleSubmit = () => loginViewModel({ email, password });
</script>

<form on:submit|preventDefault={handleSubmit}>
  <label>Email<input type="email" bind:value={email} required autocomplete="email" /></label>
  <label>Password<input type="password" bind:value={password} required autocomplete="current-password" /></label>
  {#if $${feat}Error}<p role="alert" style="color: red">{$${feat}Error}</p>{/if}
  <button type="submit" disabled={$${feat}Loading}>{$${feat}Loading ? "Logging in…" : "Log in"}</button>
</form>
`,
    },
    {
      path: `${base}/presentation/views/Register${Feat}View.svelte`,
      content: `<script lang="ts">
  import { ${feat}Loading, ${feat}Error, registerViewModel } from "../viewModels/${feat}ViewModel.js";
  let name = "", email = "", password = "";
  const handleSubmit = () => registerViewModel({ name, email, password });
</script>

<form on:submit|preventDefault={handleSubmit}>
  <label>Name<input type="text" bind:value={name} required autocomplete="name" /></label>
  <label>Email<input type="email" bind:value={email} required autocomplete="email" /></label>
  <label>Password<input type="password" bind:value={password} required autocomplete="new-password" minlength="8" /></label>
  {#if $${feat}Error}<p role="alert" style="color: red">{$${feat}Error}</p>{/if}
  <button type="submit" disabled={$${feat}Loading}>{$${feat}Loading ? "Creating account…" : "Create account"}</button>
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

// ── Generic fallback ──────────────────────────────────────────────────────────

function genericTemplates(feat: string, Feat: string, base: string, _ext: string): FileTemplate[] {
  return [
    {
      path: `${base}/domain/models/${feat}.model.ts`,
      content: `export interface ${Feat}User { id: string; email: string; name: string; }\nexport interface LoginCredentials { email: string; password: string; }\n`,
    },
    {
      path: `${base}/domain/repositories/${feat}Repository.interface.ts`,
      content: `import type { ${Feat}User, LoginCredentials } from "../models/${feat}.model.js";\nexport interface I${Feat}Repository { login(credentials: LoginCredentials): Promise<${Feat}User>; getCurrentUser(): Promise<${Feat}User | null>; }\n`,
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
  angularNgSteps: angularNgStepsGenerator,
};