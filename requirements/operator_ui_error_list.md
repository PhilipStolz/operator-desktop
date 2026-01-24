# Operator UI: Error List Layout (Spec)

Goal: Add a dedicated error list without increasing sidebar height by default.

## Layout
- Sidebar uses collapsible sections (accordion):
  1) Errors (new, top)
  2) Command Inbox (existing)
  3) Tools (templates, base64 helper, smoke test)
  4) Settings (auto scan toggle + interval, LLM profile)

## Errors section
- Header shows "Errors (N)" where N is the count.
- Default state:
  - Collapsed when N == 0.
  - Expanded when N > 0 (first appearance only).
- Each error item shows:
  - Summary line (message text).
  - Related command id when present: "related: <id>".
  - Primary action: "Copy result" (generates OPERATOR_RESULT with ok:false and copies to clipboard).
  - Secondary action: "Dismiss" (removes from list, does not affect inbox).

## Command Inbox
- No longer includes error items generated from scan issues.
- The inline error text line (currently under status) is removed to avoid duplication.

## Tools section
- Base64 helper is collapsed by default (header only when collapsed).
- Template insert + bootstrap/smoke test buttons live here.

## Settings section
- Auto scan toggle + interval.
- LLM profile select.

## Acceptance criteria
- When scan returns errors, they appear only in the Errors section.
- Errors list is the only visible error surface in the sidebar (no duplicate inline error text).
- Each error has a visible related id (if available).
- "Copy result" produces a valid OPERATOR_RESULT with ok:false and details_b64 payload.
- Sidebar does not grow in height when there are no errors (Errors section collapsed).
