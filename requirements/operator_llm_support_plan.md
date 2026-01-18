# Operator: Improvements for Better LLM Support (Implementation Plan)

Goal: Reduce friction and format errors when LLMs drive Operator via OPERATOR_CMD blocks.

## What to implement next (highest ROI first)

### 1) Precise parser/validator error messages (HIGH)
Implement explicit, actionable errors when parsing OPERATOR_CMD/OPERATOR_RESULT blocks.

Add error codes + messages like:
- ERR_MARKER_NOT_ALONE: Marker must be the only text on its line.
- ERR_MISSING_END_MARKER: Reached end of text without END_OPERATOR_CMD / END_OPERATOR_RESULT.
- ERR_NESTED_BLOCK: OPERATOR_CMD started before previous block ended.
- ERR_NON_KEY_VALUE_LINE: Inside OPERATOR_CMD only "key: value" lines allowed (one per line). Include offending line.
- ERR_EMPTY_LINE_IN_CMD: Empty lines inside OPERATOR_CMD are not allowed (treat as non-empty/invalid).
- ERR_NON_ASCII_IN_CMD: Non-ASCII character found in OPERATOR_CMD.
- ERR_MISSING_REQUIRED_FIELDS: Missing version/id/action.
- ERR_ACTION_REQUIRES_PATH: fs.* actions require path.
- ERR_ACTION_FORBIDS_PATH: operator.* actions must not include path.
- ERR_CONTENT_HAS_NEWLINES: content field contains newline; use content_b64.
- ERR_INVALID_BASE64(field=...): content_b64/patch_b64/edits_b64 is not valid base64.
- ERR_SEARCH_PATH_IS_DIR: fs.search expects file path; got directory. Suggest fs.list.

Make summaries short but specific, e.g.
"Invalid OPERATOR_CMD (ERR_NON_KEY_VALUE_LINE): line ' - foo' is not key: value".

### 2) Built-in command templates (HIGH)
In the UI add a small "Insert template" dropdown or buttons that paste valid OPERATOR_CMD skeletons:
- operator.getInterfaceSpec
- fs.list
- fs.readSlice
- fs.search (file)
- fs.write (content_b64 placeholder)
- fs.applyEdits (edits_b64 placeholder)

This removes improvisation and prevents most formatting mistakes.

### 3) Base64 helper in UI (MEDIUM-HIGH)
Add a simple "Base64" utility panel:
- Input textarea
- Output base64
- Copy button
Optional: "JSON edits -> base64" preset.

### 4) Add "golden path" examples to docs (MEDIUM)
Add 2-3 copy-ready examples (scanner-compatible) to README/spec:
- fs.write with content_b64
- fs.applyEdits with edits_b64
- Common mistake examples + the exact error they trigger

Avoid any markdown inside OPERATOR_CMD blocks in examples.

## Notes / design choices
- Prefer validation + clear errors over "automatic conversion" (magic makes debugging harder).
- Keep OPERATOR_CMD rules strict; improve the feedback instead.

## Suggested file locations (likely)
Search in the repo for:
- "OPERATOR_CMD" / "END_OPERATOR_CMD" parsing
- The renderer code that extracts commands from chat output
- Any existing validation/error reporting code

Implement errors where parsing happens; templates and helpers in the renderer UI.
