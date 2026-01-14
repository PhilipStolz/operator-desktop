# Operator

Operator is a cross-platform desktop application (Electron) that helps users safely execute actions suggested by web-based LLM chats on their local machine — without using any official provider APIs.

Operator is **human-in-the-loop**:
- LLMs propose actions in a strict text command format (`OPERATOR_CMD` blocks)
- Operator parses and validates them
- the user approves or rejects
- Operator executes within a user-selected workspace and returns an `OPERATOR_RESULT` block

## Goals

- Provide a built-in browser to access web-based chats (e.g. ChatGPT, DeepSeek) as-is
- Offer a local "Operator panel" for:
  - parsing commands from copied chat text
  - file and workspace operations
  - audit logs and confirmations
- Run on Windows and Linux

## Non-Goals

- No official provider APIs (cost-free / website-based usage only)
- No automatic scraping or automation tied to a specific chat website implementation (copy/paste workflow is the baseline)
- No executing arbitrary injected code on the host (only controlled tools and optional sandboxed scripting later)

## Safety model (short)

- All operations are scoped to a user-selected workspace root
- Writes and deletes require explicit user approval by default
- Path traversal is blocked (no ../ escaping)
- Actions are logged (audit log)
- Destructive operations should be reversible (trash or snapshots)

## Command protocol

LLMs must express executable actions only inside OPERATOR_CMD blocks:

OPERATOR_CMD
version: 1
id: 2026-01-14T12:04:10Z-002
action: fs.list
path: ./projects
END_OPERATOR_CMD

Operator answers with OPERATOR_RESULT blocks:

OPERATOR_RESULT
id: 2026-01-14T12:04:10Z-002
ok: true
summary: Listed directory.
details_b64: ...
END_OPERATOR_RESULT

## Development

Project bootstrapping in progress.

Planned stack:
- Electron with TypeScript
- React for the Operator panel UI
- IPC between renderer and main process
