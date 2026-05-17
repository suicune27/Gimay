# AGENTS.md

## Overview
This project is a Postman-like API client built with a local AI coding assistant stack using:

- CodeGPT (IDE assistant layer)
- Ollama (local model runtime)
- Qwen2.5-Coder:7B (primary code generation model)

The system is designed for:
- API request management
- Collections and environments
- Variable resolution system
- Team collaboration
- Import/export from tools like Postman, Insomnia, API Dog

---

## AI Coding Guidelines

### 1. Code Generation Style
- Prefer clean, modular, production-ready TypeScript/JavaScript
- Avoid overly verbose or unnecessary abstractions
- Keep functions single-responsibility
- Always ensure UI state consistency (no partial updates)

---

### 2. State Management Rules
- Workspace, Environment, and User data must always be fully hydrated before rendering UI
- Never render partial or undefined states
- Use retry logic for failed fetches
- Cache must be invalidated on workspace switch

---

### 3. Sync System Rules
- All mutations must use **debounced sync (5 seconds inactivity delay)**
- Batch updates whenever possible
- Avoid excessive database writes (Supabase rate protection)
- Always maintain optimistic UI updates with rollback safety

---

### 4. Variable System Rules
- Variables follow priority:
  1. Active Environment
  2. Collection variables
  3. Global (future scope)

- Must support:
  - `{{variable}}` syntax
  - Hover preview + inline editing
  - Script resolution consistency

---

### 5. UI/UX Rules
- Never use native `alert()`, `confirm()`, or `prompt()`
- Always use custom modal system for:
  - confirmations
  - creation flows
  - destructive actions
- Modals must be reusable and centralized

- Dropdowns must:
  - remain stable on hover
  - not disappear on pointer movement
  - support controlled open/close state

---

### 6. Collection & Request Rules
- Requests must support inline renaming from tab and sidebar
- Collection rename must sync across all views instantly
- Params must auto-sync into URL bidirectionally
- Headers must support bulk edit mode

---

### 7. Import System Rules
Support importing from:
- Postman
- Insomnia
- API Dog

Requirements:
- Auto-detect format when possible
- Normalize into internal schema:
  - collections
  - requests
  - folders
  - variables
  - scripts
- Always show import preview before applying changes

---

### 8. Collaboration Rules
- Teams must support roles:
  - viewer
  - editor
  - admin

- Collection-level sharing:
  - invite users directly
  - live sync updates between members
  - role-based permissions enforcement

---

## Model Notes (Qwen2.5-Coder:7B)

When generating code:
- Prefer deterministic outputs
- Avoid hallucinated APIs
- Follow existing project structure strictly
- If unsure, extend existing patterns instead of inventing new architecture

---

## Safety Rules for Code Changes
- Never break existing sync logic
- Never remove debounced save system
- Never bypass workspace/user initialization flow
- Always preserve Supabase schema constraints

---

## End of AGENTS.md