/**
 * DistrictTiles.tsx: tiles for electoral votes the map can't show well.
 *
 * Web position: beside the map. Maine and Nebraska award one electoral vote per
 * congressional district, and Washington, D.C. is too small to click on the map, so each
 * gets a tile coloured with the same margin scale.
 */

import { marginOf, stateByFips, type Nominees, type PlaceResult } from '@tippingpoint/shared';
import { leadLabel } from '../format.ts';
import { marginBin } from '../map/marginBins.ts';
import styles from './DistrictTiles.module.css';

/** D.C.'s FIPS code: shown as a tile because it is a few pixels wide on the map. */
const DC_FIPS = '11';

interface DistrictTilesProps {
  /** National results after the scenario. */
  readonly places: readonly PlaceResult[];
  readonly nominees: Nominees;
  readonly tippingPointId?: string;
  /** Open a state (ME, NE) or D.C. on the map. */
  readonly onSelectState: (stateFips: string) => void;
}

/** Short tile label: "ME-2" for districts, "DC" for D.C. */
function tileLabel(place: PlaceResult): string {
  const postal = stateByFips(place.stateFips)?.postal ?? place.stateFips;
  return place.level === 'district' ? `${postal}-${place.geoId.split('-')[1]}` : postal;
}

/** District and D.C. tiles. */
export function DistrictTiles({
  places,
  nominees,
  tippingPointId,
  onSelectState,
}: DistrictTilesProps) {
  const tiles = places.filter((p) => p.level === 'district' || p.geoId === DC_FIPS);
  return (
    <section className={styles.section} aria-labelledby="district-tiles">
      <h2 id="district-tiles" className={styles.heading}>
        Votes by district
      </h2>
      <p className={styles.note}>
        Maine and Nebraska give one electoral vote to each district’s winner.
      </p>
      <ul className={styles.tiles}>
        {tiles.map((place) => (
          <li key={place.geoId}>
            <button
              type="button"
              className={styles.tile}
              data-bin={marginBin(marginOf(place))}
              data-tipping={place.geoId === tippingPointId}
              onClick={() => onSelectState(place.stateFips)}
              aria-label={`${place.name}: ${leadLabel(place, nominees)}, ${place.electoralVotes} electoral votes`}
            >
              <span className={styles.label}>{tileLabel(place)}</span>
              <span className={`${styles.lead} tabular`}>{leadLabel(place, nominees)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
