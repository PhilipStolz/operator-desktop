# Operator Architecture

This document provides a short, developer-focused overview of the project.
The authoritative command protocol lives in `assets/operator_interface_spec.txt`.

## Structure

- `electron/main.ts`
  - Creates the BrowserWindow and BrowserView
  - Implements IPC handlers
  - Executes filesystem actions within the workspace

- `electron/preload.ts`
  - Exposes `window.operator` via contextBridge
  - IPC forwarding only (no UI logic)

- `renderer/renderer.js`
  - Operator Panel UI
  - Command inbox + execution controls
  - Result rendering and base64 utilities

## Protocol Source of Truth

The command and result protocol is specified in:
`assets/operator_interface_spec.txt`

If behavior or edge cases are unclear, update that spec first and align code + tests to it.
