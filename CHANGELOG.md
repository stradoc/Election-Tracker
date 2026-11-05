# Changelog

Newest first. Each entry lists what changed, the files touched, and what to pick up next
(RULES.md rule 5). For how the code fits together, see AGENTS.md.

---

## 2026-11-05: Phase 2 starts — ACS demographic profiles for every state and county

Branch: `phase-1-foundation`. Not committed yet.

### Changed

**New data source: Census ACS 5-year estimates.**

- The key lives in `scripts/data/.env` (gitignored; `.env.example` added). It's appended to
  requests last and kept out of every log and error message.
- Raw API responses are cached in `data/raw/census-acs5/<year>-<geography>.json`, so later
  runs work offline.
- What's fetched is listed once in `scripts/data/src/sources/acs.json`:
  - population
  - citizens 18+ (from B05003, because B29001 doesn't exist in 2016)
  - race and ethnicity
  - bachelor's degree or higher
  - median household income
  - median age

  Every variable's label was checked to mean the same thing in the 2016 and 2024 surveys.

**Each election gets the survey ending in its own year:** 2012–2016, 2016–2020 and 2020–2024.
Connecticut's 2024 counties come from the 2017–2021 survey, because later surveys report
planning regions. That's documented as a vintage override.

**New shared types and helpers.**

- `GeoProfile`, and a generic `Dataset<Place>` that `ResultsDataset` now extends.
- `DATASET_INFO` (`perOffice`), which replaces the bare `DATASETS` list.
- `datasetPath()`, now the single definition of the `data/processed` layout. Both the
  pipeline and the server use it. Profiles live at `<year>/profiles[/<fips>].json` and are
  shared by every office.
- `turnoutRate()` = votes ÷ citizens 18+.

**Pipeline.**

- `normalize/acs.ts`.
- `join.ts` reports results with no profile.
- `emit.ts` writes every dataset through one `emitDataset`.
- The manifest lists each election's `datasets`.
- `ManualDownloadRequired` is renamed `OwnerActionRequired`. It now covers both the
  guestbook download and a missing API key, through one `optional()` helper in `run.ts`.

**Server.**

- `ResultsProvider` is renamed `DataProvider`; it serves any dataset.
- `StaticProvider` now re-reads a file when it changes on disk and never caches a missing
  file. Before, a server started before `npm run data` kept serving the old manifest.
- `/api/elections` includes `datasets`.

**Web.**

- A generic `useDataset` hook; `useProfiles`.
- The hover card has a quiet "about this place" section:
  - turnout of citizens 18+
  - bachelor's degree or higher
  - race and ethnicity, largest group first
  - median income
  - the survey period

**Docs.** In `AGENTS.md`, the Later phases list was collapsed into one line by Prettier;
restored.

### Verified

- `npm run data`: every state and county result has a profile, in all three years (3,113
  county profiles against 3,112 results; the extra is Kalawao, HI).
- Spot checks against known facts:
  - Fairfax County, VA: 65% with a bachelor's degree
  - Holmes County, MS: 81% Black
  - Starr County, TX: 97% Hispanic
  - Fairfield County, CT 2024: from the 2017–2021 survey
  - De Baca County, NM: median income suppressed by the Census, so null, not 0
- National turnout (votes ÷ citizens 18+): 60.9% / 67.9% / 64.5% for 2016 / 2020 / 2024,
  close to official turnout estimates.
- 73 unit tests pass: new ACS normalizer, dataset path, turnout, profile data and API tests.
  Typecheck, lint, Prettier and the build are clean.
- `npm run e2e` (now 11 checks, including "County card shows demographics") passes for 2024
  PA, 2024 CT and 2016 WI.

### Files

- **Added:**
  - `packages/shared/src/turnout.ts`
  - `scripts/data/.env.example` (and a gitignored `scripts/data/.env`)
  - `scripts/data/src/sources/acs.ts`, `acs.json`
  - `scripts/data/src/normalize/acs.ts`, `acs.test.ts`, `acs.test.json`
  - `apps/server/src/providers/DataProvider.ts`
- **Removed:** `apps/server/src/providers/ResultsProvider.ts` (replaced by `DataProvider.ts`)
- **Changed: shared**
  - `src/schema.ts`, `src/registry.ts`, `src/sources.ts`, `src/index.ts`
  - `data/elections.json` (`acsVintage`)
  - `src/shared.test.ts`, `.json`
- **Changed: pipeline**
  - `src/run.ts`, `paths.ts`, `join.ts`, `emit.ts`
  - `src/sources/dataverse.ts`
  - `src/pipeline.test.ts`, `.json`
  - `src/normalize/president.test.json`
- **Changed: server**
  - `src/app.ts`, `routes/dataset.ts`, `providers/StaticProvider.ts`
  - `src/app.test.ts`, `.json`
- **Changed: web**
  - `src/data/api.ts`, `src/format.ts`
  - `src/map/HoverCard.tsx`, `.module.css`, `src/map/UsMap.tsx`
  - `src/pages/ElectionPage.tsx`
  - `e2e/map-check.ts`
- **Changed: docs:** `AGENTS.md`, `README.md`, `CHANGELOG.md`

### Next steps / open issues

1. **Demographics scatter** (places evidence): each county's result or swing plotted against
   a demographic (e.g. % bachelor's), with the ecological-fallacy note. This is the first
   module in the web analysis registry (`apps/web/src/analysis/registry.ts`, not created yet).
2. **Swing module:** county shift arrows 2016→2020→2024, and a state swing ranking.
3. **Population density** for "swing by county type" needs county land area. It isn't in the
   ACS API; the Census Gazetteer file is the likely source.

---

## 2026-11-05: County layer tested on real data; browser check; two fixes

Branch: `phase-1-foundation`. Not committed yet.

### Changed

**County data is live.** The owner downloaded MEDSL's county file (it was saved in the state
folder at first and moved to `data/raw/medsl-president-county/`). The pipeline joins 3,112
counties per year with no unexplained findings.

**Kansas City, MO fix.** MEDSL's 2024 file codes Kansas City as `36000`, a code that starts
with New York's state number.

- About 96k Harris votes landed in New York (+2% Dem) and went missing from Missouri (−8%).
- Remaps are now keyed `"<postal>:<code>"`, and `MO:36000` merges into Jackson County,
  alongside the existing `MO:2938000` for 2016/2020.
- A new guard drops and reports any row whose county code belongs to another state
  (`rowsInWrongState`).
- A county keeps the name of its own (non-remapped) rows, so Jackson County is never labelled
  "Kansas City".

**Known gaps are documented** in `scripts/data/src/known-gaps.json`. They're listed under
`explained` in `coverage.json`:

- Kalawao, HI: its votes are counted in Maui.
- Maine: overseas ballots are statewide-only, so counties sum about 1% low.

**Swing slider bug.** The slider was bound straight to the URL, which the router updates
asynchronously, so rapid key presses (and fast drags) snapped back and only one step
registered. The slider now keeps its own value and writes it to the URL. The URL is still the
source of truth for links and the back button.

**Hover hint.** States without county results now say "Select to zoom in" instead of
"Select to see counties".

**Browser check (`npm run e2e`).** puppeteer-core drives the system Chrome (profile in
`.tmp/`). It checks:

- the national map
- the state and county hover cards
- zoom in
- counties on the map matching the county table
- Escape, the Back button and browser back
- swing
- the theme toggle

### Verified

- `npm run e2e` passed for:
  - 2024 PA: 67 counties, zoom scale 7.8, and a −3 swing gives 222–316
  - 2024 MO: 115 counties, Jackson = 187,026 Harris (91,366 + 95,660 Kansas City)
  - 2024 CT: 8 counties
  - 2020 TX: 254 counties
  - 2016 ME: 16 counties
  - 2024 AK: county step skipped, with the page's Alaska explanation
- 55 unit tests pass. Typecheck, lint, Prettier and the build are clean.

### Files

- **Added:**
  - `scripts/data/src/known-gaps.json`
  - `apps/web/e2e/map-check.ts`
- **Changed: pipeline**
  - `scripts/data/src/normalize/president.ts`, `county-fips-fixes.json`,
    `president.test.ts`, `president.test.json`
  - `scripts/data/src/join.ts`, `run.ts`
- **Changed: web**
  - `apps/web/src/pages/ElectionPage.tsx`, `apps/web/src/map/UsMap.tsx`
  - `apps/web/tsconfig.json`, `apps/web/package.json` (puppeteer-core)
- **Changed: root and docs**
  - `package.json` (`e2e` script), `package-lock.json`
  - `AGENTS.md`, `README.md`, `CHANGELOG.md` (this entry, and the stale "push blocked" note
    below is marked resolved)

### Next steps / open issues

Phase 2 (AGENTS.md → Roadmap). The county data it depends on is now in place.

1. **ACS demographics source + `GeoProfile` schema.** This needs a free Census API key from
   the owner, in a gitignored `.env`.
2. **Swing module.** County shift arrows for 2016→2020→2024, and a state swing ranking.
3. **Turnout** (UF Election Lab + ACS CVAP), **polling error** (538 archive), then **"if only X
   voted"** (CES + CPS).

---

## 2026-11-05: Every state shows its winner's colour (no neutral "under 1" band)

Branch: `phase-1-foundation`.

### Changed

- **The neutral "under 1 point" band is gone.** Owner's request: every state shows the colour
  of whoever won it, however narrowly. Each party now has six steps: 0–1, 1–2, 2–5, 5–10,
  10–20 and 20+ points. For example, Wisconsin 2024 (Trump +0.9) is a light Trump red, and
  Georgia 2020 (Biden +0.2) a light Biden blue.
- **The neutral colour is now `tie`** (`--map-tie`), used only when a place's margin is
  exactly zero. No place in 2016–2024 is tied. It is also the midpoint of the swing slider's
  track.
- **Colours.** Regenerated in OKLCH and re-checked with the dataviz validator in both themes:
  - each arm is one hue, with visible step gaps, and its faintest step is at least 2:1
    against the canvas
  - the two 0–1 tints, which now sit side by side, are clearly distinct: ΔE 19 / 22 for
    normal vision and 14.5 / 17.5 for colour-blind vision (light / dark)
- **Legend.** It shows 12 steps, Trump's widest to Harris's widest, with no grey swatch.
- **Tests.** `marginBins.test.json` now covers the 0–1 steps, the exact tie, and the new edges.
  53 tests.

### Files

- **Changed:**
  - `apps/web/src/map/margin-bins.json`, `apps/web/src/map/marginBins.ts`,
    `apps/web/src/map/bins.css`, `apps/web/src/map/marginBins.test.json`
  - `apps/web/src/styles/tokens.css`, `apps/web/src/components/Legend.tsx`,
    `apps/web/src/components/SwingSlider.module.css`

### Next steps / open issues

- The open issue in the entry below ("races under 1 point still show the neutral colour") is
  resolved by this entry.
- ~~Pushing `phase-1-foundation` is still blocked.~~ Resolved: the remote now uses SSH
  (`git@github.com:stradoc/Election-Tracker.git`), and both commits are on GitHub.

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
