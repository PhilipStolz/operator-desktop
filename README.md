# Operator

Operator is a cross-platform desktop application (Electron + TypeScript) that embeds a web-based LLM chat (e.g. ChatGPT) and lets the LLM suggest **controlled local actions**.

Core idea: **human-in-the-loop** execution. The LLM proposes actions in strict text blocks, the user explicitly approves/rejects, Operator executes inside a user-selected workspace, and returns results.

## Goals

- Use web-based chats **as-is** (no provider APIs required)
- Provide an Operator Panel for:
  - extracting chat text (plain text)
  - scanning for commands
  - confirmations + audit log
  - workspace-scoped file operations
- Run on Windows and Linux

## Non-goals

- No official provider APIs (website-based usage only)
- No DOM scraping / no website-specific automation
- No arbitrary code execution from the LLM (only controlled, explicitly approved actions)

## Safety model

- All file operations are scoped to a user-selected **workspace root**
- Writes and deletes require explicit user approval (default)
- Path traversal is blocked (no `../` escaping)
- Actions are logged (audit log)
- Destructive ops should be reversible (trash / snapshots)

## Command protocol (v1)

Executable actions must appear **only** inside `OPERATOR_CMD` blocks:

```text
OPERATOR_CMD
version: 1
id: example-001
action: fs.list
path: .
END_OPERATOR_CMD
```

Operator answers with `OPERATOR_RESULT` blocks:

```text
OPERATOR_RESULT
id: example-001
ok: true
summary: Listed directory.
details_b64: ...
END_OPERATOR_RESULT
```

### Golden path examples

fs.write (content_b64):

```text
OPERATOR_CMD
version: 1
id: write-001
action: fs.write
path: notes/plan.txt
content_b64: QWxwaGEKQmV0YQ==
END_OPERATOR_CMD
```

fs.applyEdits (edits_b64):

```text
OPERATOR_CMD
version: 1
id: edits-001
action: fs.applyEdits
path: notes/plan.txt
edits_b64: eyJ2ZXJzaW9uIjoxLCJlZGl0cyI6W3sib3AiOiJpbnNlcnRBZnRlciIsImFuY2hvciI6IkJldGEiLCJ0ZXh0IjoiXG5HYW1tYSJ9XX0=
END_OPERATOR_CMD
```

If a command is invalid, Operator replies with a summary like:
`Invalid OPERATOR_CMD (ERR_...): <what to fix>`

### Interface discovery (important)

He app is self-describing. The first step for an LLM is:

```text
OPERATOR_CMD
version: 1
id: iface-001
action: operator.getInterfaceSpec
END_OPERATOR_CMD
```

The returned `details_b64` contains the canonical interface specification (base64 UTF-8).

### Token-efficient workflow

To avoid large context and patch failures:

1. `operator.getInterfaceSpec`
2. `fs.search` to find the relevant location
3. `fs.readSlice` to fetch exact context (line range)
4. `fs.applyEdits` for small, targeted changes

## Architecture (current)

- **Main process (Electron):**
  - hardened embedded browser + navigation allowlist
  - workspace sandbox for file ops (list/read/write/patch/delete)
  - strict scanner for `OPERATOR_CMD` blocks (DoS guards: max chars/lines)
- **Renderer: (Operator Panel):**
  - controls for Extract + Scan
  - command inbox with selection + run controls
  - confirmation UI for destructive ops

## Configuration

### Start URL

By default Operator opens ChatGPT. Override via `OPERATOR_START_URL`:

```bash
# PowerShell
$env:OPERATOR_START_URL="https://chat.openai.com/"
```


```bash
# bash
export OPERATOR_START_URL="https://chat.openai.com/"
```

### LLM selection

Operator ships with multiple LLM profiles (e.g. ChatGPT, DeepSeek). You can switch
profiles in the UI using the LLM dropdown, or set a default via `OPERATOR_LLM_ID`:

```bash
# PowerShell
$env:OPERATOR_LLM_ID="deepseek"
```

```bash
# bash
export OPERATOR_LLM_ID="deepseek"
```

### Bootstrap prompt

The bootstrap prompt is loaded from `operator_llm_bootstrap.txt` by default. Profiles
can point to different files via `electron/llmProfiles.ts`, but a single shared
prompt is usually enough.

## Development

### Prereqs

- Node.js (LTS recommended)
- npm (comes with Node)

### Install & run

```bash
npm install
npm run dev
```

### Build (example)

```bash
npm run build
```

## License

See `LICENSE `.
