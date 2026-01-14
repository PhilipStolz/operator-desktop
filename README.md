# Operator

Operator is a cross-platform desktop application (Electron + TypeScript) that helps users **safely execute local actions suggested by web-based LLM chats** — without using any official provider APIs.

Operator is **human-in-the-loop**:

- LLMs propose actions in strict `OPERATOR_CMD` blocks
- Operator parses + validates
- the user approves or rejects
- Operator executes within a user-selected workspace and returns an `OPERATOR_RESULT` block

---

## Goals

- Provide a built-in browser to access web-based chats (e.g. ChatGPT) **as-is**
- Offer a local “Operator Panel” for:
  - pasting chat output
  - parsing commands
  - confirmations + audit log
  - workspace-scoped file operations
- Run on Windows and Linux

## Non-goals

- No official provider APIs (website-based usage only)
- No DOM scraping / no website-specific automation
- No arbitrary code execution from the LLM (only controlled, explicitly approved actions)

---

## Safety model

- All operations are scoped to a user-selected **workspace root**
- Writes and deletes require explicit user approval (default)
- Path traversal is blocked (no `../` escaping)
- Actions are logged (audit log)
- Destructive ops should be reversible (trash / snapshots)

---

## Command protocol

LLMs must express executable actions **only** inside `OPERATOR_CMD` blocks.

```text
OPERATOR_CMD
version: 1
id: 2026-01-14T12:04:10Z-002
action: fs.list
path: ./projects
END_OPERATOR_CMD
```

Operator answers with `OPERATOR_RESULT` blocks:

```text
OPERATOR_RESULT
id: 2026-01-14T12:04:10Z-002
ok: true
summary: Listed directory.
details_b64: ...
END_OPERATOR_RESULT
```

Planned actions (non-exhaustive): `fs.read`, `fs.write`, `fs.list`, `fs.delete`, …

---

## Architecture (current)

- **Main process (Electron):** hardened embedded browser + navigation allowlist
- **Renderer:** currently a minimal shell page; the web chat UI is loaded in the same window
- **No provider APIs, no scraping** (copy/paste workflow is the baseline)

---

## Configuration

### Start URL

By default Operator opens ChatGPT.

Set `OPERATOR_START_URL` to override:

```bash
# PowerShell
$env:OPERATOR_START_URL="https://chat.openai.com/"
```

```bash
# bash
export OPERATOR_START_URL="https://chat.openai.com/"
```

---

## Development

### Prereqs

- Node.js (LTS recommended)
- npm (comes with Node)

### Install & run

```bash
npm install
npm run dev
```

(If your repo uses different scripts, adjust accordingly in `package.json`.)

### Build (example)

```bash
npm run build
```

---

## Roadmap

- Operator Panel UI (sidebar / inbox)
- `OPERATOR_CMD` parser + validator (versioned protocol)
- Workspace selection + scoped file ops
- Confirmations + audit log
- Optional: split web chat into a `BrowserView` for a cleaner Operator UI shell

---

## License

See `LICENSE`.
