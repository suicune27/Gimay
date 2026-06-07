export const readmeContent = `
# Gimay API Client

Gimay is a **high-performance, premium, and fully-hydrated desktop companion** for API architecture, testing, collaboration, smoke testing, and self-hosted team infrastructure.

---

## 🎨 Professional Design Philosophy

Gimay API Client features a productivity-optimized workspace inspired by modern desktop tools such as **Linear, Arc Browser, Raycast, Vercel, Notion AI, and Stripe**.

### Interface Philosophy

- **Warm-Slate Dynamic Surfaces** — Eliminates harsh pure-white interfaces. Uses premium layered surfaces, glassmorphism, soft elevation, and subtle transparency.
- **Premium Theme Engine** — Full Light/Dark mode parity. Monaco Editor, Prism, and syntax systems synchronize instantly across theme transitions.
- **Modern Desktop Shell** — Native Electron title bars replaced with custom desktop controls including Minimize, Maximize, Restore, and Close interactions.
- **Adaptive Sidebar System** — Hover-expand navigation sidebar that collapses into compact icon mode automatically.

---

## ✨ Core Features

### 1. Multi-Process Secured Electron Architecture

Hardened Electron runtime configuration prevents unsafe execution patterns:

- \`contextIsolation: true\`
- \`nodeIntegration: false\`
- Secure \`preload.cjs\` bridge
- Sandboxed renderer communication
- IPC validation layers
- RCE attack surface reduction

### 2. Dynamic Self-Healing Port Allocation

The internal development server automatically resolves port collisions. Detects occupied ports, falls back to the next available port, and synchronizes Electron dynamically.

### 3. Window State & Coordinate Persistence

Remembers window size, screen position, maximized state, and multi-monitor coordinates. Persisted inside \`%APPDATA%/Gimay/window-state.json\`.

### 4. Desktop Tray Controller

Integrated system tray with quick workspace restoration, silent background mode, update checking, fast exit controls, and cache flush actions.

### 5. Multi-Client Collection Importer

Import and normalize collections from **Postman**, **Insomnia**, **API Dog**, OpenAPI schemas, and Swagger exports. Includes request normalization, variable migration, folder preservation, and environment conversion.

### 6. Self-Hosted Team Infrastructure

Fully self-hosted collaborative environments with:

- **Team-Based Tenant Isolation** — Separate tenant databases per organization
- **Custom Database Hosting** — Connect your own Supabase projects, PostgreSQL instances, or managed cloud databases
- **Team Collaboration** — Invite members, share workspaces, role-based access (viewer, editor, admin)
- **Smart Environment Routing** — Authentication via global environment, workspace operations use the selected tenant

### 7. Integrated Smoke Testing Engine

Built-in smoke testing for validating APIs, environments, and deployments:

- Rapid endpoint validation
- Automated request sequences
- Assertion support (status codes, headers, body, JSON structure, auth states, latency)
- Environment-aware execution (dev, staging, production)
- Execution insights and error diagnostics

### 8. Script Library & Sandbox

Advanced JavaScript runtime supporting:

- Pre-request hooks and test assertions
- Monaco editor with autocompletion
- Request mutation syncing
- Dynamic request injection
- Offline sandbox mode

---

## 🛠️ Development Commands

### Desktop Development Mode

\`\`\`bash
npm run desktop:dev
\`\`\`

### Production Windows Installer

\`\`\`bash
npm run desktop:build
\`\`\`

### Portable Executable

\`\`\`bash
npm run desktop:portable
\`\`\`

### Unpacked Sandbox

\`\`\`bash
npm run desktop:pack
\`\`\`

---

## 🚀 Web Development

### Install Dependencies

\`\`\`bash
npm install
\`\`\`

### Configure Environment

Create \`.env.local\` with:

\`\`\`env
GEMINI_API_KEY=your_key_here
\`\`\`

### Launch Dev Server

\`\`\`bash
npm run dev
\`\`\`

---

## 🧱 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| Build Tool | Vite |
| Desktop Runtime | Electron |
| Styling | TailwindCSS v4 |
| Database | Supabase / PostgreSQL |
| State Management | Zustand |
| Code Editor | Monaco Editor |
| Local Server | Express |
| Packaging | Electron Builder |

---

## 🔐 Security Principles

- Secure preload isolation
- Sandboxed renderer
- IPC validation
- Disabled unsafe Electron APIs
- Tenant environment isolation
- Protected credential flows

---

## 🌍 Roadmap

- Git synchronization
- Automated API monitoring
- CI/CD smoke pipelines
- Realtime team collaboration
- Request history replay
- AI-powered request generation
- Cloud workspace syncing
- Linux/macOS native builds
`;
