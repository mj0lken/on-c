# Security policy

## Reporting a vulnerability

Please don't open a public issue for security problems. Report them privately through
[GitHub's vulnerability reporting](https://github.com/mj0lken/on-c/security/advisories/new)
instead.

Useful things to include: the `on/c` version (or commit SHA), your macOS or browser version,
what an attacker can do, and the steps to reproduce it.

## Supported versions

Only the [latest release](https://github.com/mj0lken/on-c/releases/latest) and the live web app
on `main` get fixes.

## What's in scope

`on/c` evaluates expressions with a custom hand-written recursive-descent parser (never `eval()` or
`new Function()`), stores sheets and settings locally (`localStorage`), and on macOS exposes a
single Tauri IPC command (`export_sheet_file`) restricted to writing user-initiated exports inside
`~/Downloads` with path-component sanitization.

Anything that achieves arbitrary code execution through sheet input or pasted content, escapes the
`~/Downloads` export path boundary in the Tauri app, or transmits sheet contents off the user's
device without explicit user action is a vulnerability.
