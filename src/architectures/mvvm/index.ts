import type { Architecture, FileTemplate, GenerateContext } from "../../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// MVVM Architecture
//
// Convention:
//   src/features/<feature>/
//     models/       → Pure data / domain entities (Model)
//     services/     → API & business logic layer
//     viewModels/   → State management & business logic hook (ViewModel)
//     views/        → UI components consuming ViewModel (View)
//
// 📌 TODO for contributors:
//   Implement `generate()` returning FileTemplate[] for each supported framework.
//   See src/architectures/screaming/index.ts for a complete reference.
// ─────────────────────────────────────────────────────────────────────────────

function generate(ctx: GenerateContext): FileTemplate[] {
  const { featureName, framework } = ctx;
  const feat = featureName;
  const Feat = feat.charAt(0).toUpperCase() + feat.slice(1);
  const base = `src/features/${feat}`;

  // Each framework gets its own template builder
  const builders: Record<string, () => FileTemplate[]> = {
    react: () => reactTemplates(feat, Feat, base),
    // TODO: Add vue, angular, svelte builders here
  };

  const builder = builders[framework.id];

  if (!builder) {
    throw new Error(`My Architecture does not support ${framework.name} yet. ` + "See CONTRIBUTING.md to add support.");
  }

  return builder();
}

// ── React MVVM Templates ──────────────────────────────────────────────────────

function reactTemplates(feat: string, Feat: string, base: string): FileTemplate[] {
  return [
    // ── Model: Pure domain data interfaces ──
    {
      path: `${base}/models/${feat}.model.ts`,
      content: `// Model: Pure data interfaces for ${Feat} feature
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
`,
    },

    // ── Service: API/business logic layer ──
    {
      path: `${base}/services/${feat}Service.ts`,
      content: `import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../models/${feat}.model.js";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const ${feat}Service = {
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

    // ── ViewModel: React hook managing state & logic ──
    {
      path: `${base}/viewModels/use${Feat}ViewModel.ts`,
      content: `import { useState, useEffect, useCallback } from "react";
import type { ${Feat}User, LoginCredentials, RegisterPayload } from "../models/${feat}.model.js";
import { ${feat}Service } from "../services/${feat}Service.js";

export interface ${Feat}ViewModelState {
  user: ${Feat}User | null;
  isLoading: boolean;
  error: string | null;
}

export function use${Feat}ViewModel(): ${Feat}ViewModelState & {
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
    ${feat}Service
      .getCurrentUser()
      .then((user) => setState((prev) => ({ ...prev, user, isLoading: false })))
      .catch(() => setState((prev) => ({ ...prev, user: null, isLoading: false })));
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const user = await ${feat}Service.login(credentials);
      setState((prev) => ({ ...prev, user, isLoading: false }));
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
      setState((prev) => ({ ...prev, user, isLoading: false }));
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

    // ── View: Login form component ──
    {
      path: `${base}/views/Login${Feat}View.tsx`,
      content: `import { useState, type FormEvent } from "react";
import { use${Feat}ViewModel } from "../viewModels/use${Feat}ViewModel.js";

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

    // ── View: Register form component ──
    {
      path: `${base}/views/Register${Feat}View.tsx`,
      content: `import { useState, type FormEvent } from "react";
import { use${Feat}ViewModel } from "../viewModels/use${Feat}ViewModel.js";

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

    // ── Public API ──
    {
      path: `${base}/index.ts`,
      content: `// Public API for ${Feat} feature (MVVM)
export { use${Feat}ViewModel } from "./viewModels/use${Feat}ViewModel.js";
export { Login${Feat}View } from "./views/Login${Feat}View.js";
export { Register${Feat}View } from "./views/Register${Feat}View.js";
export type { ${Feat}User, LoginCredentials, RegisterPayload } from "./models/${feat}.model.js";
`,
    },
  ];
}

export const mvvmArchitecture: Architecture = {
  id: "mvvm",
  name: "MVVM",
  description: "Model-View-ViewModel: reactive bindings between VM and View.",
  folderConvention: "src/features/<feature>/{models, services, viewModels, views}/",
  generate,
};
