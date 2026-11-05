/**
 * ResultsTable.tsx: every place in the current view as a sortable table.
 *
 * Web position: below the map. It is the full-detail, accessible version of the map:
 * states (plus ME/NE districts) nationally, or one state's counties when zoomed in.
 * Rows show scenario-adjusted numbers, so the table always agrees with the map.
 */

import { useState } from 'react';
import { marginOf, type Nominees, type PlaceResult } from '@tippingpoint/shared';
import { formatVotes, leadLabel, shareOf, surname } from '../format.ts';
import { marginBin } from '../map/marginBins.ts';
import { SegmentedControl } from './SegmentedControl.tsx';
import styles from './ResultsTable.module.css';

/** Ways to order the rows. */
type SortKey = 'closest' | 'margin' | 'name' | 'votes';

/** Comparator for each sort order. */
const SORTS: Readonly<Record<SortKey, (a: PlaceResult, b: PlaceResult) => number>> = {
  closest: (a, b) => Math.abs(marginOf(a)) - Math.abs(marginOf(b)),
  margin: (a, b) => marginOf(b) - marginOf(a),
  name: (a, b) => a.name.localeCompare(b.name),
  votes: (a, b) => b.total - a.total,
};

interface ResultsTableProps {
  readonly places: readonly PlaceResult[];
  readonly nominees: Nominees;
  /** Heading above the table, e.g. "Every state". */
  readonly title: string;
  /** Show the electoral-votes column (national view only). */
  readonly showElectoralVotes: boolean;
  /** Make place names buttons that open that state on the map. */
  readonly onSelectState?: (stateFips: string) => void;
}

/** Sortable results table. */
export function ResultsTable({
  places,
  nominees,
  title,
  showElectoralVotes,
  onSelectState,
}: ResultsTableProps) {
  const [sort, setSort] = useState<SortKey>('closest');
  const rows = [...places].sort(SORTS[sort]);
  const demName = surname(nominees.dem);
  const repName = surname(nominees.rep);

  return (
    <section className={styles.section} aria-labelledby="results-table">
      <div className={styles.toolbar}>
        <h2 id="results-table" className={styles.title}>
          {title}
        </h2>
        <SegmentedControl<SortKey>
          label="Sort rows"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'closest', label: 'Closest' },
            { value: 'margin', label: `Most ${demName}` },
            { value: 'name', label: 'A–Z' },
            { value: 'votes', label: 'Most votes' },
          ]}
        />
      </div>

      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Place</th>
              {showElectoralVotes && <th scope="col">Electoral votes</th>}
              <th scope="col">{demName}</th>
              <th scope="col">{repName}</th>
              <th scope="col">Lead</th>
              <th scope="col">Total votes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((place) => (
              <tr key={place.geoId}>
                <th scope="row">
                  {onSelectState === undefined ? (
                    place.name
                  ) : (
                    <button
                      type="button"
                      className={styles.placeButton}
                      onClick={() => onSelectState(place.stateFips)}
                    >
                      {place.name}
                    </button>
                  )}
                </th>
                {showElectoralVotes && <td className="tabular">{place.electoralVotes}</td>}
                <td className="tabular">{shareOf(place, 'dem')}</td>
                <td className="tabular">{shareOf(place, 'rep')}</td>
                <td className="tabular">
                  <span
                    className={styles.swatch}
                    data-bin={marginBin(marginOf(place))}
                    aria-hidden="true"
                  />
                  {leadLabel(place, nominees)}
                </td>
                <td className="tabular">{formatVotes(place.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
