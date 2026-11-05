/**
 * map-check.ts: clicks through the site in a real (headless) Chrome and reports what works.
 *
 * Web position: the end-to-end check for the map. Unit tests cover the math; this covers
 * what a person does: hover a state, open it, see its counties, zoom back out (Escape,
 * the Back button, browser back), drag the swing slider, switch themes.
 *
 * Usage: start the site (`npm run dev`), then in another terminal `npm run e2e`.
 * Options (environment variables):
 *   E2E_BASE_URL  site address (default http://localhost:5173)
 *   E2E_YEAR      election year (default 2024)
 *   E2E_STATE     state to open, postal code (default pa)
 *   CHROME_PATH   Chrome binary (default /usr/bin/google-chrome)
 * Screenshots go to .tmp/e2e/. Chrome's profile and caches stay in .tmp/ (RULES.md rule 2).
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Page } from 'puppeteer-core';
import { stateByPostal } from '@tippingpoint/shared';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const TMP_DIR = path.join(REPO_ROOT, '.tmp');
const SHOTS_DIR = path.join(TMP_DIR, 'e2e');
const CHROME_HOME = path.join(TMP_DIR, 'chrome-home');

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const YEAR = process.env.E2E_YEAR ?? '2024';
const STATE_POSTAL = (process.env.E2E_STATE ?? 'pa').toLowerCase();
const CHROME_PATH = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

/** Desktop viewport the checks run at. */
const VIEWPORT_WIDTH = 1440;
const VIEWPORT_HEIGHT = 1000;
const VIEWPORT = { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT };
/** Longer than the --dur-zoom token (750 ms), so the zoom has finished when we measure. */
const ZOOM_SETTLE_MS = 1200;
const WAIT_TIMEOUT_MS = 15_000;
/** 50 states + D.C. are drawn as clickable shapes. */
const STATE_SHAPES = 51;
/** Each ArrowLeft press moves the slider one 0.5-point step toward Republicans. */
const SWING_PRESSES = 6;
const EXPECTED_SWING_PARAM = 'swing=-3';
/** Decimal places when printing the zoom scale. */
const SCALE_DIGITS = 2;
/** Text that only appears in the hover card's demographics section. */
const PROFILE_MARKER = 'Turnout of citizens 18+';
/** How much of a hover card's text to print in the report. */
const CARD_PREVIEW_CHARS = 80;

/**
 * The first number inside an SVG scale() transform. d3's transition writes two numbers,
 * "scale(4.21,4.21)", and the initial attribute has one, "scale(1)"; both match.
 * Matches "scale(4.21" in "translate(10,20) scale(4.21,4.21)" (capturing 4.21); does not
 * match "translate(0,0)".
 * Tester: https://regex101.com/?regex=scale%5C(%28%5B%5Cd.%5D%2B%29&testString=translate(10%2C20)%20scale(4.21%2C4.21)
 */
const SCALE_PATTERN = /scale\(([\d.]+)/;

/** County shapes: coloured map paths that aren't the clickable state buttons. */
const COUNTY_SHAPE = 'svg path:not([role])[data-bin]';
/** The page's explanation box (e.g. "Alaska reports … by state house district"). */
const NOTICE = 'p[class*="notice"]';

/** One check's outcome. "skip" means it couldn't run here (e.g. no county data yet). */
interface CheckResult {
  readonly check: string;
  readonly result: 'pass' | 'fail' | 'skip';
  readonly detail: string;
}

/** The map layer's current transform scale (1 = national view). */
async function zoomScale(page: Page): Promise<number> {
  const transform = await page.$eval('svg > g', (g) => g.getAttribute('transform') ?? '');
  const match = SCALE_PATTERN.exec(transform);
  return match === null ? 1 : Number(match[1]);
}

/** The two electoral-vote counts shown in the EV bar, Dem first. */
async function electoralCounts(page: Page): Promise<string[]> {
  return page.$$eval('section[aria-label="Electoral votes"] span[class*="count"]', (spans) =>
    spans.map((span) => span.textContent ?? ''),
  );
}

/** Wait for the zoom animation to finish. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ZOOM_SETTLE_MS));
}

/** Record a pass or fail. */
function verdict(check: string, ok: boolean, detail: string): CheckResult {
  return { check, result: ok ? 'pass' : 'fail', detail };
}

async function main(): Promise<void> {
  const state = stateByPostal(STATE_POSTAL);
  if (state === undefined) throw new Error(`Unknown state "${STATE_POSTAL}"`);
  await mkdir(SHOTS_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    userDataDir: path.join(TMP_DIR, 'chrome-profile'),
    args: ['--no-first-run', '--no-default-browser-check'],
    env: {
      ...process.env,
      HOME: CHROME_HOME,
      XDG_CONFIG_HOME: CHROME_HOME,
      XDG_CACHE_HOME: CHROME_HOME,
    },
  });
  const results: CheckResult[] = [];

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    const nationalUrl = `${BASE_URL}/${YEAR}/president`;
    const stateUrl = `${nationalUrl}/${STATE_POSTAL}`;
    const stateShape = `path[aria-label^="${state.name}:"]`;

    // 1. National map draws every state.
    await page.goto(nationalUrl, { waitUntil: 'networkidle0' });
    await page.waitForSelector(stateShape, { timeout: WAIT_TIMEOUT_MS });
    const shapes = await page.$$eval('svg path[role="button"]', (paths) => paths.length);
    results.push(
      verdict('National map draws every state', shapes === STATE_SHAPES, `${shapes} shapes`),
    );
    const actualCounts = await electoralCounts(page);

    // 2. Hovering a state shows its result card.
    await page.hover(stateShape);
    const cardHandle = await page.waitForSelector('[role="status"]', { timeout: WAIT_TIMEOUT_MS });
    const card = await cardHandle?.evaluate((el) => el.textContent ?? '');
    results.push(
      verdict('Hover card shows the state', card?.includes(state.name) ?? false, card ?? 'no card'),
    );

    // 3. Clicking a state zooms in and changes the URL.
    await page.click(stateShape);
    await settle();
    const zoomed = await zoomScale(page);
    results.push(
      verdict(
        'Click zooms into the state',
        page.url() === stateUrl && zoomed > 1,
        `${page.url()}, scale ${zoomed.toFixed(SCALE_DIGITS)}`,
      ),
    );

    // 4. The state's counties appear on the map and in the table, or the page explains why
    //    not (Alaska has no county results; any state before the county file is downloaded).
    await page.waitForSelector(`${COUNTY_SHAPE}, ${NOTICE}`, { timeout: WAIT_TIMEOUT_MS });
    const countyShapes = await page.$$eval(COUNTY_SHAPE, (paths) => paths.length);
    if (countyShapes === 0) {
      const notice = await page.$$eval(NOTICE, (ps) =>
        ps.map((p) => p.textContent ?? '').join(' '),
      );
      results.push({
        check: 'Counties appear',
        result: notice.length > 0 ? 'skip' : 'fail',
        detail: notice.length > 0 ? notice : 'no counties and no explanation shown',
      });
    } else {
      const tableTitle = await page.$eval('#results-table', (h) => h.textContent ?? '');
      const tableRows = await page.$$eval('table tbody tr', (rows) => rows.length);
      results.push(
        verdict(
          'Counties appear (map and table agree)',
          countyShapes > 0 && countyShapes === tableRows && tableTitle.includes('by county'),
          `${countyShapes} county shapes, ${tableRows} table rows, "${tableTitle}"`,
        ),
      );
      await page.hover(COUNTY_SHAPE);
      const countyCard = await page.$eval('[role="status"]', (el) => el.textContent ?? '');
      results.push(
        verdict(
          'Hovering a county shows its card',
          countyCard.length > 0,
          countyCard.slice(0, CARD_PREVIEW_CHARS),
        ),
      );
      const profileText = countyCard.slice(countyCard.indexOf(PROFILE_MARKER));
      results.push(
        verdict(
          'County card shows demographics (ACS)',
          countyCard.includes(PROFILE_MARKER) && countyCard.includes('Census ACS'),
          profileText.slice(0, CARD_PREVIEW_CHARS),
        ),
      );
    }
    // Let the hover card finish its fade-in so the screenshot shows it as people see it.
    await settle();
    await page.screenshot({ path: path.join(SHOTS_DIR, `state-${STATE_POSTAL}.png`) });

    // 5. Escape zooms back out.
    await page.keyboard.press('Escape');
    await settle();
    const afterEscape = await zoomScale(page);
    results.push(
      verdict(
        'Escape returns to the national map',
        page.url() === nationalUrl && afterEscape === 1,
        page.url(),
      ),
    );

    // 6. The "Back to national map" button and browser back both zoom out too.
    await page.click(stateShape);
    await settle();
    await page.click('button ::-p-text(Back to national map)');
    await settle();
    results.push(
      verdict('Back button returns to the national map', page.url() === nationalUrl, page.url()),
    );
    await page.click(stateShape);
    await settle();
    await page.goBack();
    await settle();
    results.push(
      verdict('Browser back returns to the national map', page.url() === nationalUrl, page.url()),
    );

    // 7. The swing slider updates the URL and the electoral votes.
    await page.focus('#swing');
    // Press ArrowLeft SWING_PRESSES times, one after another.
    await Array.from({ length: SWING_PRESSES }).reduce<Promise<void>>(async (previous) => {
      await previous;
      await page.keyboard.press('ArrowLeft');
    }, Promise.resolve());
    await settle();
    const swungCounts = await electoralCounts(page);
    results.push(
      verdict(
        'Swing slider shifts the map',
        page.url().includes(EXPECTED_SWING_PARAM) && swungCounts.join() !== actualCounts.join(),
        `EVs ${actualCounts.join('–')} → ${swungCounts.join('–')}`,
      ),
    );
    await page.screenshot({ path: path.join(SHOTS_DIR, 'swing.png') });

    // 8. The theme toggle flips the theme.
    const before = await page.$eval('html', (html) => html.getAttribute('data-theme'));
    await page.click('button[aria-label^="Switch to"]');
    const after = await page.$eval('html', (html) => html.getAttribute('data-theme'));
    results.push(verdict('Theme toggle switches theme', before !== after, `${before} → ${after}`));
  } finally {
    await browser.close();
  }

  console.table(results);
  console.log(`Screenshots: ${SHOTS_DIR}`);
  if (results.some((r) => r.result === 'fail')) process.exitCode = 1;
}

await main();
