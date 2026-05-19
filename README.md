<div align="center">
  <img width="1200" height="475" alt="Putmen Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  
  <br/>
  
  <h1>🛰️ Putmen API Client</h1>
  <p><strong>A high-performance, premium, and fully-hydrated desktop companion for API architecture, testing, and team collaboration.</strong></p>

  <p>
    <a href="https://ai.studio/apps/22660092-1c88-492c-a74b-550101adf694">
      <img src="https://img.shields.io/badge/AI%20Studio-Active%20Deployment-00E676?style=flat-square&logo=google" alt="AI Studio"/>
    </a>
    <img src="https://img.shields.io/badge/OS-Windows%2010%20%2F%2011-0078D4?style=flat-square&logo=windows" alt="OS Windows"/>
    <img src="https://img.shields.io/badge/Engine-Vite%20%2B%20React%20%2B%20TypeScript-6272F4?style=flat-square&logo=react" alt="Engine"/>
    <img src="https://img.shields.io/badge/Runtime-Electron-47848F?style=flat-square&logo=electron" alt="Runtime"/>
  </p>
</div>

---

## 🎨 Professional Design Philosophy & Aesthetics

Putmen features an elegant, productivity-optimized workspace interface inspired by top-tier modern productivity tools like **Linear, Vercel, Arc Browser, Notion AI, and Stripe**:

* **Warm-Slate Dynamic Surfaces**: Avoids stark `#FFFFFF` layouts. Renders soft tinted panels, glassmorphic dropdowns with backdrop blurring, and subtle elevated card styling.
* **Premium Theme Engine**: Includes full-parity Light and Dark mode options. The system synchronizes embedded Monaco and Prism code-editors instantly between theme modifications.
* **Custom Desktop Header Controls**: Under native execution, standard title bars are replaced with custom borderless controls for Minimizing, Maximizing, and Closing the app.

---

## ✨ Outstanding Core Features

### 🎛️ 1. Multi-Process Secured Architecture
Hardened sandboxing configurations disable unsafe Electron parameters. Enforces `contextIsolation: true` and `nodeIntegration: false` via a CommonJS `preload.cjs` context bridge to block Remote Code Execution (RCE) vectors.

### 🌐 2. Dynamic Self-Healing Port Allocation
The Express/Vite local developer servers automatically detect port collisions. If port `3000` is active, the listener catches the error, increments the port, and mounts on the next available port. Electron main processes read the active port dynamically from `.port.tmp` with custom exponential retries to launch successfully in any context.

### 💾 3. State Coordinates Bounds Memory
Remembers the client's last exact position, coordinate layout, and size inside `%APPDATA%/Putmen/window-state.json`. Restores the window size perfectly on launch to prevent desktop distortions.

### 🚀 4. Taskbar Tray Controller
Integrates a taskbar tray utility supporting quick workspace restoration, updates scanning, and graceful cache-flush exits.

### 🔌 5. Multi-Client Schema Importer
Supports importing collections and requests directly from **Postman**, **Insomnia**, and **API Dog**, converting and normalizing schemas automatically with full preview flows.

---

## 🛠️ Unified Development & Compilation Commands

Use the following scripts in your terminal to dev, build, and package the Windows desktop environment:

### 1. Concurrently Spawning Developer Clients
Spawns the local Express/Vite server and launches the Electron shell wrapper. The shell will automatically self-heal and poll until the dynamic port is listening.
```bash
npm run desktop:dev
```

### 2. Compiling Windows Clean Installers
Bundles all production React assets and compiles the Windows NSIS Setup Wizard (`.exe`) target.
```bash
npm run desktop:build
```

### 3. Compiling Portable Standalone Executables
Compiles a single, direct, standalone Windows portable executable with zero pre-installation requirements.
```bash
npm run desktop:portable
```

### 4. Dry-Run Packaging Sandbox Directories
Packs production assets directly into a local unpacked folder (`dist_electron/win-unpacked/`) for testing binary resources and preload bindings.
```bash
npm run desktop:pack
```

---

## 📂 Distributable Build Output Directory

All build and packaging tasks generate outputs directly in the root workspace folder:

```bash
dist_electron/
├── Putmen Setup 0.0.0.exe      # Windows 10/11 NSIS Installer Wizard
├── Putmen 0.0.0.exe            # Windows Portable Standalone Binary
└── win-unpacked/               # Unpacked Desktop Executable Directory
```

---

## 🚀 Standard Web Server Dev Sequence

For standard web previewing without the native Electron shell:

1. **Install workspace dependencies**:
   ```bash
   npm install
   ```
2. **Setup environment variables**:
   Configure `.env.local` or environment keys to include your `GEMINI_API_KEY`.
3. **Launch dev environment**:
   ```bash
   npm run dev
   ```
