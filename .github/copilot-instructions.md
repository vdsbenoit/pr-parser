# Copilot Instructions

## Project Snapshot
- This repo is a Deno CLI (`src/main.ts`) with dual functionality:
  1. **PR Title Parsing**: Converts plain text into formatted PR titles with ticket identifiers and part suffixes
  2. **Screenshot Tables**: Converts HTML clipboard contents of `<img>` tags into grouped comparison tables
- macOS packaging lives under `app/PRParser.app`; `deno compile` drops the binary in `app/PRParser.app/script` for a double-clickable app.
- There are no external services; functionality hinges on local shell utilities (`pbpaste`, `pbcopy`, `osascript`).

## Clipboard Entry Point (`src/main.ts`)
- `convertClipboard()` is the main entry point that routes to either PR title parsing or screenshot table generation based on clipboard content
- If clipboard doesn't start with `<img`, it triggers PR title parsing flow
- If clipboard starts with `<img`, it triggers screenshot table flow

## PR Title Flow
- `parsePRTitle()` extracts ticket ID (first two words), handles "no ticket"/"noticket" cases, finds last "part N" suffix, and formats feature name
- Ticket ID: First two words converted to `[WORD1-WORD2]` uppercase, except "no ticket" → `[no-ticket]` lowercase
- Part suffix: Last occurrence of "part N" (N = number) extracted as `[PART-N]`
- Feature name: Remaining words with first letter capitalized
- All whitespace is normalized and trimmed

## Clipboard ➜ Table Flow (`src/main.ts`)
- `convertClipboard()` is the entry point: show notification → read clipboard HTML → parse images → group → generate table → write back to clipboard → surface results.
- `parseFilename()` extracts ordering, feature numbers, and timing (`before|after|standalone`) from image `alt` text. Keep its regex semantics in sync with tests.
- `parseImages()` walks `<img>` tags, normalizes `alt` text via `parseFilename()`, and sorts by the numeric prefix. Maintain strict attribute parsing; missing `alt` or `src` should skip entries.
- `groupImagesByCategory()` splits standalone images vs before/after pairs. The `order` field controls rendering order—preserve or update this when changing grouping logic.
- `generateTable()` renders HTML rows: standalone images first (two per row), then category sections with Before/After columns. Width is hard-coded to `400`—coordinate changes here with downstream consumers.

## macOS Integration
- `isRunningFromApp()` toggles behavior: CLI logs when run via `deno run`, dialogs/notifications when launched as the bundled app.
- Dialogs and notifications call `osascript`; failure should bail early with `showDialog(..., type='error')`. Test helpers stub these by running in CLI mode.
- Clipboard operations shell out to `pbpaste`/`pbcopy`; any new features must respect `--allow-run` permissions.

## Tasks & Workflows (`deno.json`)
- `deno task start` → quick CLI run (no `--watch`).
- `deno task dev` → watch mode with same permissions; useful while tweaking parsing/formatting.
- `deno task build` → produce CLI binary in `dist/pr-parser`.
- `deno task build:app` → compile then copy binary into the `.app` bundle. Run this before distributing the macOS app.

## Testing Expectations (`src/main.test.ts`)
- Tests import and exercise exported helpers from `src/mod.ts`. Keep coverage focused on public helpers used by clipboard parsing.
- Use `deno test` for the suite; prefer extending `src/main.test.ts` when adding new parsing scenarios.

## Coding Conventions
- TypeScript targeting Deno; no npm dependencies. Stick with standard library imports via `jsr:@std/...`.
- Keep async shell interactions wrapped with `Deno.Command`; provide friendly logs for CLI mode.
- Preserve minimal logging; informative emoji outputs (`✅/❌`) are intentional for CLI UX.
- When adding new functionality, export helpers from `src/mod.ts` and test them directly in `src/main.test.ts`.

## When Modifying
- Changes affecting ordering, grouping, or HTML structure demand updates to both helper logic and tests.
- If you expand macOS behavior (new dialogs/notifications), ensure app mode vs CLI mode parity and adjust permissions/tasks when needed.
- Document any new commands or workflow steps in `README.md` so packaging instructions stay aligned.

## Common Gotchas
- Do not run `deno run` to test your changes; use `deno test` instead
- Do not create demo or example files after making changes
