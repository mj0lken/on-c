# on/c

Natural-language notepad calculator for macOS (Tauri v2) and the Web (React + TypeScript + Vite), inspired by Numi.

## Highlights

- **TI-style running `ans` & row references**: `ans` automatically chains the immediately preceding output; click any earlier result to bind and insert `ans1`, `ans2`, or custom variables (`rent = $1,850`).
- **Natural-language expressions**: Inline labels (`Flight: $420`), descriptive words (`2 singel + 0.7 gul`), visual `---` section dividers, `# Heading` titles, and `//` notes.
- **Currencies, units & math**: 35+ live/offline FX currencies, physical/CSS/temperature/date conversions, percentages (`15% off $120`), trig (`sin 30°`), bitwise operations, and hex/bin/oct bases.
- **Smart sheets & safe archives**: New sheets open with `# ` ready for a title (with unambiguous `#xyz` fallback IDs). Closing non-empty tabs archives them for 7, 30, or 90 days with one-click restore in Preferences (`⌘,`).
- **Quick `/char`, `/help`, & Export**: Inline `/char` math symbol toolbar + searchable picker, compact `/help` syntax reference, and bottom-right `.md` / `.csv` / aligned clipboard export.

## Development

```sh
npm install
npm run dev      # Start Vite dev server on http://localhost:1420
npm test         # Run Vitest unit suite
npm run build    # Type-check & bundle web production assets
```

## Native macOS App (Tauri v2)

```sh
npm run tauri:dev
npm run tauri:build
```
