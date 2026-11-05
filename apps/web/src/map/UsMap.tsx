/**
 * UsMap.tsx: the one map component, for both the national view and a zoomed-in state.
 *
 * Web position: the centre of the page. It draws whatever results it is given (already
 * adjusted by the scenario engine) and reports clicks upward; it holds no election logic.
 * - National: every state coloured by margin, the tipping-point state outlined.
 * - State selected: the map zooms to that state (useMapZoom), other states fade, and the
 *   state's counties fade in on top, coloured the same way.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { marginOf, type GeoProfile, type Nominees, type PlaceResult } from '@tippingpoint/shared';
import { leadLabel } from '../format.ts';
import { MAP_HEIGHT, MAP_WIDTH, useGeometry, type MapShape } from './geometry.ts';
import { HoverCard, type CardPosition } from './HoverCard.tsx';
import { marginBin } from './marginBins.ts';
import { useMapZoom } from './useMapZoom.ts';
import styles from './UsMap.module.css';

interface UsMapProps {
  /** National results after the scenario (states plus ME/NE districts). */
  readonly national: readonly PlaceResult[];
  /** The selected state's county results after the scenario, if loaded. */
  readonly counties?: readonly PlaceResult[];
  readonly selectedStateFips?: string;
  /** geoId of the tipping-point place, outlined in the national view. */
  readonly tippingPointId?: string;
  readonly nominees: Nominees;
  /** State FIPS codes that have county results, so the hover hint only offers real ones. */
  readonly countyStates: readonly string[];
  /** Demographic profiles by geoId (states and the open state's counties), when loaded. */
  readonly profiles?: ReadonlyMap<string, GeoProfile>;
  /** Called with a state's FIPS when clicked, or undefined to return to the national view. */
  readonly onSelectState: (stateFips: string | undefined) => void;
}

/** Hover-card hint for a state in the national view, depending on whether it has counties. */
const HINT_WITH_COUNTIES = 'Select to see counties';
const HINT_WITHOUT_COUNTIES = 'Select to zoom in';

/** What the hover card is showing, and where (no position = keyboard focus). */
interface HoverState {
  readonly id: string;
  readonly place: PlaceResult;
  readonly position?: CardPosition;
}

/** Keys that activate a focused state, like a button. */
const ACTIVATE_KEYS = new Set(['Enter', ' ']);

/** The interactive US map. */
export function UsMap({
  national,
  counties,
  selectedStateFips,
  tippingPointId,
  nominees,
  countyStates,
  profiles,
  onSelectState,
}: UsMapProps) {
  const geometry = useGeometry();
  const frameRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const [hover, setHover] = useState<HoverState | undefined>();

  const stateResults = useMemo(
    () => new Map(national.filter((p) => p.level === 'state').map((p) => [p.geoId, p])),
    [national],
  );
  const countyResults = useMemo(
    () => new Map((counties ?? []).map((p) => [p.geoId, p])),
    [counties],
  );

  const selectedShape = geometry.data?.states.find((shape) => shape.id === selectedStateFips);
  useMapZoom(layerRef, selectedShape?.feature);

  // A view change moves every shape, so a card left over from the old view would be wrong.
  useEffect(() => setHover(undefined), [selectedStateFips]);

  if (geometry.data === undefined) {
    return (
      <div className={styles.frame} aria-busy="true">
        <p className={styles.loading}>Drawing the map…</p>
      </div>
    );
  }

  const isZoomed = selectedStateFips !== undefined;
  const stateHint = (stateFips: string): string =>
    countyStates.includes(stateFips) ? HINT_WITH_COUNTIES : HINT_WITHOUT_COUNTIES;
  const countyShapes =
    isZoomed && countyResults.size > 0
      ? (geometry.data.countiesByState.get(selectedStateFips) ?? [])
      : [];
  const allShapes = [...geometry.data.states, ...countyShapes];
  const hoverShape = allShapes.find((shape) => shape.id === hover?.id);
  const tippingShape = isZoomed
    ? undefined
    : geometry.data.states.find((s) => s.id === tippingPointId);

  /** Show the card for a place at the pointer's position inside the frame. */
  const showAtPointer = (shape: MapShape, place: PlaceResult) => (event: PointerEvent) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (rect === undefined) return;
    setHover({
      id: shape.id,
      place,
      position: {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        frameWidth: rect.width,
      },
    });
  };

  const activateState = (stateFips: string) => (event: KeyboardEvent) => {
    if (!ACTIVATE_KEYS.has(event.key)) return;
    event.preventDefault();
    onSelectState(stateFips);
  };

  return (
    <div ref={frameRef} className={styles.frame} onPointerLeave={() => setHover(undefined)}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="group"
        aria-label={isZoomed ? `${selectedShape?.name} by county` : 'Results by state'}
        onClick={(event) => {
          // A click on empty space (not on a shape) returns to the national view.
          if (isZoomed && event.target === event.currentTarget) onSelectState(undefined);
        }}
      >
        <g ref={layerRef}>
          <g>
            {geometry.data.states.map((shape) => {
              const place = stateResults.get(shape.id);
              if (place === undefined) return null;
              return (
                <path
                  key={shape.id}
                  className={styles.state}
                  d={shape.d}
                  data-bin={marginBin(marginOf(place))}
                  data-dimmed={isZoomed && shape.id !== selectedStateFips}
                  tabIndex={0}
                  role="button"
                  aria-label={`${place.name}: ${leadLabel(place, nominees)}`}
                  onPointerMove={showAtPointer(shape, place)}
                  onFocus={() => setHover({ id: shape.id, place })}
                  onBlur={() => setHover(undefined)}
                  onClick={() => onSelectState(shape.id)}
                  onKeyDown={activateState(shape.id)}
                />
              );
            })}
          </g>

          {countyShapes.length > 0 && (
            <g className={styles.counties} key={selectedStateFips}>
              {countyShapes.map((shape) => {
                const place = countyResults.get(shape.id);
                if (place === undefined) return null;
                return (
                  <path
                    key={shape.id}
                    className={styles.county}
                    d={shape.d}
                    data-bin={marginBin(marginOf(place))}
                    onPointerMove={showAtPointer(shape, place)}
                  />
                );
              })}
            </g>
          )}

          {tippingShape !== undefined && <path className={styles.tipping} d={tippingShape.d} />}
          {hoverShape !== undefined && <path className={styles.hoverOutline} d={hoverShape.d} />}
        </g>
      </svg>

      {hover !== undefined && (
        <HoverCard
          place={hover.place}
          profile={profiles?.get(hover.id)}
          nominees={nominees}
          position={hover.position}
          hint={hover.place.level === 'state' && !isZoomed ? stateHint(hover.id) : undefined}
        />
      )}
    </div>
  );
}
