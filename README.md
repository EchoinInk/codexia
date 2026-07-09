# Codexia  
A local, privacy‑first AI coding agent that behaves like a real engineer — predictable, project‑aware, and fully under your control.

Codexia runs entirely on your machine, understands your project structure, and edits files safely using explicit, diff‑first operations. No cloud calls. No hidden rewrites. No surprises.

---

## ✨ Features

- **Local‑first**  
  All inference and file operations happen on your machine.

- **Strict path fidelity**  
  Codexia uses the exact file paths you provide — no interpretation, no rewriting.

- **Safe editing workflow**  
  - Shows diffs before applying changes  
  - Asks for confirmation on destructive edits  
  - Never deletes files without explicit approval  
  - Avoids malformed JSON and hydration‑breaking output

- **Project‑aware intelligence**  
  Remembers the file you’re working on, stays within your workspace root, and keeps context tight.

- **Markdown‑safe output**  
  Responses avoid common pitfalls in Next.js, React, and other frameworks.

- **Identity‑driven behaviour**  
  Codexia follows a defined system prompt that shapes its tone, safety rules, and engineering style.

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd codexia
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the development server
```bash
npm run dev
```

### 4. Open Codexia
```
http://localhost:3000
```

---

## 🧠 Architecture Overview

Codexia is built on:

- **Next.js** — UI and local API routes  
- **Custom system prompt** — defines identity, safety rules, and editing behaviour  
- **Local tool‑calling layer** — handles file diffs, edits, and project navigation  
- **Workspace root** — your chosen directory (e.g., `/Users/<you>/Projects`)

Codexia interacts with your files through controlled, explicit operations.  
It never performs hidden actions.

---

## 📁 Example Project Structure

```
codexia/
  ├── app/
  │   ├── api/
  │   │   └── generate/
  │   │       └── route.ts
  │   └── page.tsx
  ├── components/
  ├── lib/
  ├── public/
  ├── package.json
  └── README.md
```

---

## 🔧 Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Run production build
```

---

## 🛡️ Privacy

Codexia is fully local:

- No external API calls  
- No telemetry  
- No cloud inference  
- Your code never leaves your machine

---

## 🧩 Customization

Codexia’s behaviour is controlled by its system prompt. You can customize:

- personality (pragmatic, warm, hybrid)  
- editing rules  
- tool‑calling logic  
- project navigation  
- safety constraints  
- output formatting style  

This lets you evolve Codexia into the exact coding partner you want.

---

## 📣 Roadmap

- Local image generation  
- Multi‑project memory  
- Workspace visualizer  
- Plugin system  
- Offline model switching  
- Custom tool registry  

---

## ❤️ Built for builders

Codexia is designed for developers who want:

- privacy  
- control  
- predictable behaviour  
- safe file editing  
- and an AI agent that feels like a real collaborator
