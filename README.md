<div align="center">
  <h1>🛰️ Gimay API Client</h1>
  <p>
    <strong>
      A high-performance, premium, and fully-hydrated desktop companion for API architecture,
      testing, collaboration, smoke testing, and self-hosted team infrastructure.
    </strong>
  </p>

  <p>
    <a href="https://ai.studio/apps/22660092-1c88-492c-a74b-550101adf694">
      <img src="https://img.shields.io/badge/AI%20Studio-Active%20Deployment-00E676?style=flat-square&logo=google" alt="AI Studio"/>
    </a>
    <img src="https://img.shields.io/badge/OS-Windows%2010%20%2F%2011-0078D4?style=flat-square&logo=windows" alt="OS Windows"/>
    <img src="https://img.shields.io/badge/Engine-Vite%20%2B%20React%20%2B%20TypeScript-6272F4?style=flat-square&logo=react" alt="Engine"/>
    <img src="https://img.shields.io/badge/Runtime-Electron-47848F?style=flat-square&logo=electron" alt="Runtime"/>
    <img src="https://img.shields.io/badge/Database-Self%20Hosted%20Ready-3ECF8E?style=flat-square&logo=supabase" alt="Database"/>
  </p>
</div>

---

# 🎨 Professional Design Philosophy & Aesthetics

Gimay API Client features a productivity-optimized workspace inspired by modern desktop tools such as **Linear, Arc Browser, Raycast, Vercel, Notion AI, and Stripe**.

## ✨ Interface Philosophy

- **Warm-Slate Dynamic Surfaces**
  - Eliminates harsh pure-white interfaces.
  - Uses premium layered surfaces, glassmorphism, soft elevation, and subtle transparency.

- **Premium Theme Engine**
  - Full Light/Dark mode parity.
  - Monaco Editor, Prism, and syntax systems synchronize instantly across theme transitions.

- **Modern Desktop Shell**
  - Native Electron title bars are replaced with custom desktop controls.
  - Includes custom Minimize, Maximize, Restore, and Close interactions.

- **Adaptive Sidebar System**
  - Hover-expand navigation sidebar.
  - Collapses into compact icon mode automatically.
  - Smooth transitions inspired by Linear and Notion.

---

# ✨ Outstanding Core Features

## 🎛️ 1. Multi-Process Secured Electron Architecture

Hardened Electron runtime configuration prevents unsafe execution patterns:

- `contextIsolation: true`
- `nodeIntegration: false`
- Secure `preload.cjs` bridge
- Sandboxed renderer communication
- IPC validation layers
- RCE attack surface reduction

---

## 🌐 2. Dynamic Self-Healing Port Allocation

The internal development server automatically resolves port collisions.

### Features

- Detects occupied ports automatically
- Falls back to next available port
- Electron dynamically reads active runtime port
- Exponential retry polling system
- Reliable startup synchronization

### Example

```txt
3000 occupied → 3001 → 3002 ...
```

---

## 💾 3. Window State & Coordinate Persistence

The desktop client remembers:

- Window size
- Screen position
- Maximized state
- Multi-monitor coordinates

State is persisted inside:

```txt
%APPDATA%/Gimay/window-state.json
```

---

## 🚀 4. Desktop Tray Controller

Integrated system tray utility includes:

- Quick workspace restoration
- Silent background mode
- Update checking
- Fast exit controls
- Cache flush actions

---

## 🔌 5. Multi-Client Collection Importer

Import and normalize collections directly from:

- Postman
- Insomnia
- API Dog
- OpenAPI schemas
- Swagger exports

### Includes

- Request normalization
- Variable migration
- Folder preservation
- Environment conversion
- Schema validation preview

---

# 🏢 6. Self-Hosted Team Infrastructure

Gimay supports fully self-hosted collaborative environments.

Teams can configure and host their own database infrastructure while preserving isolated tenant environments.

## Supported Features

### 🔐 Team-Based Tenant Isolation

- Separate tenant databases per organization
- Secure environment switching
- Team-scoped collections and requests
- Tenant-aware workspace persistence

### 🌍 Custom Database Hosting

Teams can connect their own:

- Supabase projects
- PostgreSQL instances
- Managed cloud databases
- Private internal infrastructure

### 👥 Team Collaboration

- Invite team members
- Workspace sharing
- Role-based collaboration
- Team onboarding flows
- Invite token validation

### 🔄 Smart Environment Routing

Authentication and team discovery use the global environment, while workspace operations automatically switch to the selected tenant environment.

### Architecture Flow

```txt
Main Environment
 ├── Authentication
 ├── Team Discovery
 └── Invite Resolution

Selected Team Tenant
 ├── Workspace Data
 ├── Collections
 ├── Requests
 ├── Environments
 └── Persistence Layer
```

---

# 🧪 7. Integrated Smoke Testing Engine

Gimay includes a built-in smoke testing system for validating APIs, environments, and deployments quickly.

## Smoke Testing Features

### ⚡ Rapid Endpoint Validation

- Validate API uptime instantly
- Verify deployment readiness
- Detect broken routes quickly

### 🔁 Automated Request Sequences

- Chain multiple API requests
- Validate response flows
- Execute environment-based checks

### 📊 Assertion Support

Supports validations for:

- Status codes
- Headers
- Response body
- JSON structure
- Authentication states
- Latency thresholds

### 🧠 Environment-Aware Execution

Smoke tests automatically adapt to:

- Development
- Staging
- Production
- Team tenant environments

### 📈 Execution Insights

- Success/failure summaries
- Request timing analytics
- Error diagnostics
- Execution logs

---

# 🛠️ Unified Development & Compilation Commands

Use the following scripts for development, packaging, and production builds.

---

## 1. Desktop Development Mode

Launches:

- Vite development server
- Electron desktop shell
- Dynamic port synchronization

```bash
npm run desktop:dev
```

---

## 2. Production Windows Installer Build

Compiles:

- React production assets
- Electron application
- NSIS Windows installer

```bash
npm run desktop:build
```

---

## 3. Portable Standalone Executable

Builds a portable executable without installation requirements.

```bash
npm run desktop:portable
```

---

## 4. Unpacked Packaging Sandbox

Outputs unpacked binaries for testing:

```bash
npm run desktop:pack
```

Generated output:

```txt
dist_electron/win-unpacked/
```

---

# 📂 Build Output Directory

All generated artifacts are stored inside:

```txt
dist_electron/
├── Gimay Setup 0.0.0.exe
├── Gimay Portable 0.0.0.exe
└── win-unpacked/
```

---

# 🚀 Standard Web Development Flow

For standard browser-based development:

## 1. Install Dependencies

```bash
npm install
```

---

## 2. Configure Environment Variables

Create:

```txt
.env.local
```

Configure:

```env
GEMINI_API_KEY=your_key_here
```

---

## 3. Launch Development Server

```bash
npm run dev
```

---

# 🧱 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| Build Tool | Vite |
| Desktop Runtime | Electron |
| UI Framework | HeroUI |
| Styling | TailwindCSS |
| Database | Supabase / PostgreSQL |
| State Management | Zustand |
| Code Editor | Monaco Editor |
| Local Server | Express |
| Packaging | Electron Builder |

---

# 🔐 Security Principles

Gimay follows strict desktop security standards:

- Secure preload isolation
- Sandboxed renderer
- IPC validation
- Disabled unsafe Electron APIs
- Tenant environment isolation
- Protected credential flows
- Safe environment switching

---

# 🌍 Future Roadmap

Planned platform expansions include:

- Git synchronization
- Automated API monitoring
- CI/CD smoke pipelines
- Realtime team collaboration
- Request history replay
- AI-powered request generation
- Cloud workspace syncing
- Linux/macOS native builds

---

# 📄 License

Private proprietary software. All rights reserved.
