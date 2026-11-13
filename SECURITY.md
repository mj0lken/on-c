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

`on/c` evaluates expressions with a hand-written recursive-descent parser (never `eval()` or
`new Function()`), stores sheets and preferences locally in `localStorage`, and on macOS enforces a
strict WebView Content Security Policy (`object-src 'none'`, `base-uri 'none'`,
`frame-ancestors 'none'`, and outbound `connect-src` restricted solely to `https://open.er-api.com`
for anonymous public FX rates) alongside a single Tauri IPC command (`save_export_file`) scoped to
writing `.md`, `.csv`, or `.txt` files inside `~/Downloads` with path-traversal and dotfile
sanitization.

Anything that achieves arbitrary code execution through sheet input or pasted content, escapes the
`~/Downloads` export path or extension allowlist in the Tauri app, or transmits sheet contents off
the user's device without explicit user action is a vulnerability.
