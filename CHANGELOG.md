# Changelog

Newest first. Each entry lists what changed, the files touched, and what to pick up next
(RULES.md rule 5). For how the code fits together, see AGENTS.md.

---

## 2026-11-05: Separate colour step for 1–2 point wins

Branch: `phase-1-foundation`. Committed together with the Phase 1 entry below.

### Changed

- **Map margin scale.** It went from 4 to 5 steps per party: 1–2, 2–5, 5–10, 10–20 and 20+
  points, plus the "under 1" toss-up. Before, a 1–2 point win shared the faint 1–5 tint, which
  looked greyed out (e.g. Michigan 2024, Trump +1.4).
- **Colours.**
  - All party steps were regenerated in OKLCH. The narrow steps are more saturated, so they
    read as a win rather than as grey.
  - The toss-up neutral moved away from them: lighter on paper (`#dcd6ca`), darker on black
    (`#2a2924`).
  - Re-checked with the dataviz validator in both themes:
    - each arm is one hue, with visible step gaps, and its faintest step is at least 2:1
      against the canvas
    - the narrowest Dem / toss-up / narrowest Rep trio clears ΔE 15 (normal vision) and
      ΔE 8 (colour-blind)
- **Legend.** It sizes its columns from the number of steps instead of a hard-coded 9.
- **Tests.** Added `marginBins.test.ts`, which pins the bin edges and the legend order. 52
  tests now.

### Files

- **Changed:**
  - `apps/web/src/map/margin-bins.json`, `apps/web/src/map/marginBins.ts`,
    `apps/web/src/map/bins.css`
  - `apps/web/src/styles/tokens.css`, `apps/web/src/components/Legend.module.css`
- **Added:** `apps/web/src/map/marginBins.test.ts`, `apps/web/src/map/marginBins.test.json`

### Next steps / open issues

- **Races under 1 point still show the neutral toss-up colour**, e.g. Wisconsin 2024 (Trump
  +0.9) and Georgia 2020 (Biden +0.2). That is deliberate: they read as too close to call.
  If the owner wants every winner shown, give the under-1 band a faint party tint instead.
  That would be a 6th step per arm, so re-run the validator.

---

## 2026-11-05: Phase 1 foundation (presidential map, swing, tipping point)

Branch: `phase-1-foundation`. Committed together with the colour-step entry above (the first
commit on this branch).

### Changed

**Project rules and handoff docs.**

- `RULES.md`: the owner's five rules.
- `AGENTS.md`: architecture map and recipes.
- `CLAUDE.md`: imports both.
- `README.md`: for people visiting the repo.

**Monorepo.**

- npm workspaces: `packages/shared`, `scripts/data`, `apps/server`, `apps/web`.
- Node runs TypeScript directly (type stripping), so there's no build step for the server
  or pipeline.
- `.npmrc` keeps npm's cache and logs inside the repo.

**Shared package.**

- One `PlaceResult` schema for every level, and an election registry.
- Reference data moved to JSON:
  - electoral-vote apportionments for 2012–2028 (each checked to sum to 538)
  - registered elections
  - states with no county layer
- The math: margins, uniform swing, Electoral College totals, tipping point.
- `computeScenario`, the single what-if engine.

**Data pipeline (`npm run data`).**

- Downloads MEDSL's state presidential file from Harvard Dataverse (pinned v10.1).
- Handles the guestbook-protected county file by printing manual steps, then continuing
  with states only.
- Normalizes MEDSL rows:
  - nominees are matched by surname, so fusion party lines count correctly
  - when a county has a TOTAL row, only TOTAL rows are used (no double-counting by vote mode)
  - documented FIPS remaps: Oglala Lakota, Bedford city, Kansas City
- Adds curated ME/NE district results for 2016/2020/2024. Dem/Rep figures come from the
  National Archives certificates of ascertainment and match the statewide totals exactly.
  Maine 2016 differs by 184 overseas ballots, as the certificate notes.
- Checks coverage against the map shapes and writes `data/processed`.

**API (Fastify).**

- `GET /api/elections`.
- `GET /api/:year/:office/:dataset[/:stateFips]`.
- Read through a `ResultsProvider` interface (`StaticProvider` for now), with a day-long
  cache header.

**Web app (React 18 + Vite + D3).**

- The EV bar with the 270 line.
- A national map coloured on a validated 9-step margin scale, with the tipping-point state
  outlined and named in a sentence that updates live.
- Click a state to zoom in. Counties fade in once the county file is present. Back button,
  Esc, browser back or clicking empty space zooms out.
- Hover cards, a swing slider (R+10 to D+10, stored in the URL), and tiles for ME/NE
  districts and D.C.
- A sortable results table, and a Sources list built from `SOURCES`.
- Paper light theme and black dark theme, set before first paint. Reduced motion respected.
  Phone layout checked at 390px.

**Tooling.**

- Vitest 5 (39 tests).
- ESLint 10 + typescript-eslint, Prettier.
- `npm audit`: 0 vulnerabilities, after upgrading csv-parse to 7 and Vitest to 5 and adding a
  `minimatch` override.

### Verified

- `npm test`: 39/39 pass. The processed data reproduces the pledged electoral votes:
  - 2016: Trump 306–232
  - 2020: Biden 306–232
  - 2024: Trump 312–226

  The tipping points are Wisconsin, Wisconsin and Pennsylvania.

- `npm run typecheck`, `npm run lint`, `npx prettier --check .` and `npm run build` are clean.
- Pipeline coverage: 51 states + 5 districts per year, no mismatches.
- Headless Chrome screenshots at 1440px and 390px, in light and dark, national and state
  views.

### Not yet verified

- **County layer on real data.** It needs the manual county download. The county normalizer
  is unit-tested on synthetic rows. After the download, check `data/processed/coverage.json`:
  - "no map shape"
  - "no result"
  - state-vs-county sum mismatches

  Connecticut 2024 is worth watching: the Census moved to planning regions in 2022, and
  MEDSL may have followed.

- **Interactive behaviour.** The zoom animation, hover cards, keyboard focus on states and
  slider dragging were reviewed in code and static screenshots only, not clicked through in
  a live browser.

### Files

**Added: repo root**

- `RULES.md`, `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, `README.md`
- `.gitignore`, `.npmrc`, `.prettierrc.json`, `.prettierignore`
- `package.json`, `package-lock.json`, `tsconfig.base.json`, `vitest.config.ts`,
  `eslint.config.js`

**Added: `packages/shared/`**

- `package.json`, `tsconfig.json`
- `data/`: `apportionment.json`, `elections.json`, `no-county-layer.json`
- `src/`: `index.ts`, `schema.ts`, `registry.ts`, `sources.ts`, `fips.ts`, `ev-tables.ts`,
  `margins.ts`, `swing.ts`, `electoral.ts`, `scenario.ts`, `dev-config.ts`,
  `shared.test.ts`, `shared.test.json`

**Added: `scripts/data/`**

- `package.json`, `tsconfig.json`
- `src/`: `run.ts`, `paths.ts`, `join.ts`, `emit.ts`, `pipeline.test.ts`,
  `pipeline.test.json`
- `src/sources/`: `dataverse.ts`, `ev-districts.ts`, `ev-districts.json`
- `src/normalize/`: `president.ts`, `county-fips-fixes.json`, `president.test.ts`,
  `president.test.json`

**Added: `apps/server/`**

- `package.json`, `tsconfig.json`, `.env.example`
- `src/`: `index.ts`, `app.ts`, `app.test.ts`, `app.test.json`, `routes/dataset.ts`
- `src/providers/`: `ResultsProvider.ts`, `StaticProvider.ts`

**Added: `apps/web/`**

- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/`: `main.tsx`, `format.ts`, `data/api.ts`
- `src/styles/`: `tokens.css`, `base.css`
- `src/theme/`: `useTheme.ts`, `ThemeToggle.tsx`, `ThemeToggle.module.css`
- `src/map/`:
  - `UsMap.tsx` + `.module.css`, `HoverCard.tsx` + `.module.css`
  - `useMapZoom.ts`, `geometry.ts`, `marginBins.ts`, `margin-bins.json`, `bins.css`
- `src/components/` (each `.tsx` + `.module.css`): `EvBar`, `SwingSlider`,
  `TippingPointNote`, `DistrictTiles`, `Legend`, `ResultsTable`, `SegmentedControl`
- `src/pages/`: `ElectionPage.tsx` + `.module.css`

**Unchanged:** `LICENSE`.

### Deviations from the plan

- **Partisan colours live in `apps/web/src/styles/tokens.css`** (plus `map/marginBins.ts`),
  not `packages/shared/src/colors.ts`. Only the web app uses colours, and keeping them as CSS
  tokens means a theme switch recolours the map without JavaScript.
- **`ratings.ts` became `margins.ts`.** It holds margin math and formatting; forecast-style
  ratings aren't needed for results.
- **No `tsx`.** Node 22's built-in type stripping runs the `.ts` files.
- **Reference numbers live in JSON.** The TypeScript-patterns hook rejects numeric literals in
  code, so EV tables, election rows, margin bins and test cases are JSON files loaded by
  small, documented TS modules.

### Next steps / open issues

1. **Owner:** download the county file (README → "County results"), run `npm run data`, and
   check `coverage.json`. Fix any FIPS mismatches in `normalize/county-fips-fixes.json`.
2. Click through the zoom, hover and keyboard flows in a real browser. Tune
   `FIT_PADDING`/`MAX_SCALE` in `useMapZoom.ts` if small states zoom awkwardly.
3. **Start Phase 2** (AGENTS.md → Roadmap): add the ACS source (it needs a free Census API key
   in `apps/server/.env` or a pipeline `.env`) and a `GeoProfile` schema, then the swing
   module (county shift arrows 2016→2020→2024).
4. Remove the `minimatch` override when eslint/typescript-eslint depend on minimatch 11.
