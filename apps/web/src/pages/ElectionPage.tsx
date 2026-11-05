/**
 * ElectionPage.tsx: one election, nationally or zoomed into a state.
 *
 * Web position: the page that wires data to views. The URL is the source of truth:
 *   /2024/president            national map
 *   /2024/president/pa         Pennsylvania's counties
 *   ?swing=-2.5                every state 2.5 points more Republican
 * So the browser's back button zooms out, and any view can be shared as a link.
 * All numbers shown pass through computeScenario() from the shared package.
 */

import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  computeScenario,
  isActual,
  NO_COUNTY_LAYER,
  SOURCES,
  stateByFips,
  stateByPostal,
  type Office,
  type Scenario,
} from '@tippingpoint/shared';
import { DistrictTiles } from '../components/DistrictTiles.tsx';
import { EvBar } from '../components/EvBar.tsx';
import { Legend } from '../components/Legend.tsx';
import { ResultsTable } from '../components/ResultsTable.tsx';
import { SegmentedControl } from '../components/SegmentedControl.tsx';
import { MAX_SWING_POINTS, SwingSlider } from '../components/SwingSlider.tsx';
import { TippingPointNote } from '../components/TippingPointNote.tsx';
import { isNotFound, useElections, useResults } from '../data/api.ts';
import { leadLabel } from '../format.ts';
import { UsMap } from '../map/UsMap.tsx';
import { ThemeToggle } from '../theme/ThemeToggle.tsx';
import styles from './ElectionPage.module.css';

/** The slider works in points; the scenario engine in fractions of the vote. */
const PERCENT = 100;

/** URL for a view. State is the lower-case postal code, e.g. /2024/president/pa. */
export function viewPath(year: number, office: string, stateFips?: string): string {
  const postal = stateFips === undefined ? undefined : stateByFips(stateFips)?.postal.toLowerCase();
  return postal === undefined ? `/${year}/${office}` : `/${year}/${office}/${postal}`;
}

/** Read the swing from the URL, ignoring anything that isn't a number in range. */
function swingFromUrl(raw: string | null): number {
  const value = Number(raw ?? 0);
  if (!Number.isFinite(value)) return 0;
  return Math.max(-MAX_SWING_POINTS, Math.min(MAX_SWING_POINTS, value));
}

/** The election page. */
export function ElectionPage() {
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();

  const year = Number(params.year);
  const office = (params.office ?? 'president') as Office;
  const selected = params.state === undefined ? undefined : stateByPostal(params.state);
  const swingPoints = swingFromUrl(search.get('swing'));

  const elections = useElections();
  const listing = elections.data?.find((e) => e.year === year && e.office === office);
  const hasCounties =
    selected !== undefined && (listing?.countyStates.includes(selected.fips) ?? false);
  const national = useResults(year, office, undefined, listing !== undefined);
  const counties = useResults(year, office, selected?.fips, hasCounties);

  const scenario: Scenario = useMemo(() => ({ swing: swingPoints / PERCENT }), [swingPoints]);
  const nationalView = useMemo(
    () =>
      national.data === undefined ? undefined : computeScenario(national.data.places, scenario),
    [national.data, scenario],
  );
  const countyView = useMemo(
    () =>
      counties.data === undefined ? undefined : computeScenario(counties.data.places, scenario),
    [counties.data, scenario],
  );

  /** Open a state (or return to the national map), keeping the current swing. */
  const goTo = (stateFips: string | undefined): void => {
    navigate({ pathname: viewPath(year, office, stateFips), search: search.toString() });
  };

  const setSwing = (points: number): void => {
    setSearch(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (points === 0) next.delete('swing');
        else next.set('swing', String(points));
        return next;
      },
      { replace: true },
    );
  };

  // Escape zooms back out to the national map.
  useEffect(() => {
    if (selected === undefined) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape')
        navigate({ pathname: viewPath(year, office), search: search.toString() });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, navigate, year, office, search]);

  const yearOptions = (elections.data ?? [])
    .filter((e) => e.office === office)
    .map((e) => ({ value: e.year, label: String(e.year) }));

  const header = (
    <header className={styles.header}>
      <Link to="/" className={styles.wordmark}>
        TippingPoint
      </Link>
      {yearOptions.length > 0 && (
        <SegmentedControl<number>
          label="Election year"
          options={yearOptions}
          value={year}
          onChange={(next) =>
            navigate({
              pathname: viewPath(next, office, selected?.fips),
              search: search.toString(),
            })
          }
        />
      )}
      <ThemeToggle />
    </header>
  );

  if (elections.isError || national.isError) {
    return (
      <div className={styles.page}>
        {header}
        <p className={styles.notice}>
          Results couldn’t be loaded. Check that the API server is running (npm run dev) and that
          the pipeline has run (npm run data).
        </p>
      </div>
    );
  }

  if (elections.data !== undefined && listing === undefined) {
    return (
      <div className={styles.page}>
        {header}
        <p className={styles.notice}>
          TippingPoint doesn’t cover {params.year} {office} yet. Pick a year above.
        </p>
      </div>
    );
  }

  if (nationalView === undefined || national.data === undefined) {
    return (
      <div className={styles.page}>
        {header}
        <p className={styles.notice} aria-busy="true">
          Loading results…
        </p>
      </div>
    );
  }

  const nominees = national.data.candidates;
  const tipping = nationalView.places.find((p) => p.geoId === nationalView.tippingPointId);
  const selectedResult = nationalView.places.find((p) => p.geoId === selected?.fips);
  const countyMessage =
    selected === undefined || hasCounties
      ? undefined
      : (NO_COUNTY_LAYER[selected.fips] ??
        `County results for ${year} haven’t been generated yet. Download the county file and run npm run data (see the README).`);

  return (
    <div className={styles.page}>
      {header}

      <main>
        <section className={styles.hero}>
          <EvBar totals={nationalView.electoral} nominees={nominees} />
        </section>

        <section className={styles.stage}>
          <div className={styles.mapColumn}>
            {selected !== undefined && (
              <div className={styles.stateBar}>
                <button type="button" className={styles.back} onClick={() => goTo(undefined)}>
                  Back to national map
                </button>
                <h1 className={styles.stateName}>{selected.name}</h1>
                {selectedResult !== undefined && (
                  <span className={`${styles.stateLead} tabular`}>
                    {leadLabel(selectedResult, nominees)}
                  </span>
                )}
              </div>
            )}
            <UsMap
              national={nationalView.places}
              counties={hasCounties ? countyView?.places : undefined}
              selectedStateFips={selected?.fips}
              tippingPointId={nationalView.tippingPointId}
              nominees={nominees}
              onSelectState={goTo}
            />
            {countyMessage !== undefined && <p className={styles.notice}>{countyMessage}</p>}
            {counties.isError && !isNotFound(counties.error) && (
              <p className={styles.notice}>
                County results couldn’t be loaded. Try again in a moment.
              </p>
            )}
            <Legend nominees={nominees} />
          </div>

          <aside className={styles.panel}>
            <TippingPointNote
              place={tipping}
              totals={nationalView.electoral}
              nominees={nominees}
              isActual={isActual(scenario)}
            />
            <SwingSlider value={swingPoints} onChange={setSwing} />
            <DistrictTiles
              places={nationalView.places}
              nominees={nominees}
              tippingPointId={nationalView.tippingPointId}
              onSelectState={goTo}
            />
          </aside>
        </section>

        <section className={styles.details}>
          {selected !== undefined && countyView !== undefined ? (
            <ResultsTable
              key={`counties-${selected.fips}`}
              title={`${selected.name} by county`}
              places={countyView.places}
              nominees={nominees}
              showElectoralVotes={false}
            />
          ) : (
            <ResultsTable
              key="states"
              title="Every state"
              places={nationalView.places}
              nominees={nominees}
              showElectoralVotes
              onSelectState={goTo}
            />
          )}
        </section>
      </main>

      <footer className={styles.footer}>
        <h2 className={styles.footerTitle}>Sources</h2>
        <ul className={styles.sources}>
          {Object.values(SOURCES).map((source) => (
            <li key={source.id}>
              <a href={source.url}>{source.title}</a>, {source.publisher}. {source.license}.
            </li>
          ))}
        </ul>
        <p className={styles.method}>
          The swing control adds the same number of points to every state’s and county’s margin.
          Real elections don’t move that evenly; it shows how close each result was.
        </p>
      </footer>
    </div>
  );
}
