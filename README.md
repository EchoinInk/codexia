# Codexia

A local "mini Cursor" coding workspace. Next.js 15 + Tailwind + Ollama, HorizonUI-inspired.

## Setup

1. **Install Ollama** and pull a coding model:

   ```bash
   ollama pull qwen2.5-coder
   # or: ollama pull deepseek-coder
   ```

2. **Install deps**:

   ```bash
   bun install   # or npm install / pnpm install
   ```

3.**Configure** — copy `.env.example` to `.env.local` and set:

- `WORKSPACE_DIR` — absolute path Codexia is allowed to read/write
- `OLLAMA_URL` — default `http://localhost:11434`
- `OLLAMA_MODEL` — default `qwen2.5-coder`

4.**Run**:

   ```bash
   bun dev
   ```

   Open `http://localhost:3000`

## Features

- Streaming chat with a local Ollama model
- Markdown + syntax-highlighted code blocks with copy buttons
- File explorer scoped to `WORKSPACE_DIR` (path traversal blocked)
- File viewer with syntax highlighting
- Tool calling: the model can emit a single JSON block like

  ```json

  { "tool": "read_file", "args": { "path": "src/index.ts" } }
  ```

  and the server executes it, then feeds the result back. Supported tools:
  `read_file`, `write_file`, `list_files`, `delete_file`.
- Diff preview before applying AI edits.

## Safety

Every `/api/fs/*` route resolves the requested path against `WORKSPACE_DIR` and rejects anything that escapes it. Still — point `WORKSPACE_DIR` at a project, not your home folder.
