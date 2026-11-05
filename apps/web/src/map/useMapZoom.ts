/**
 * useMapZoom.ts: animates the map between the national view and one state.
 *
 * Web position: the only code that moves the map. React renders the paths; this hook
 * owns the zoom layer's `transform` attribute through a ref and animates it with
 * d3-transition. React never sets that attribute, so the two never fight over it.
 * The duration comes from the --dur-zoom token, so reduced-motion users get an instant cut.
 */

import { useEffect, type RefObject } from 'react';
import { easeCubicOut } from 'd3-ease';
import { select } from 'd3-selection';
import 'd3-transition';
import type { Feature, Geometry } from 'geojson';
import { MAP_HEIGHT, MAP_WIDTH, mapPath } from './geometry.ts';

/** Share of the frame a zoomed state may fill; the rest is breathing room. */
const FIT_PADDING = 0.86;
/** Small states (Rhode Island, Delaware) would otherwise zoom absurdly far. */
const MAX_SCALE = 9;
const HALF = 0.5;
const IDENTITY = 'translate(0,0) scale(1)';

/** SVG transform that centres `target` and scales it to fill the frame. */
function fitTransform(target: Feature<Geometry>): string {
  const [[x0, y0], [x1, y1]] = mapPath.bounds(target);
  const scale = Math.min(
    MAX_SCALE,
    FIT_PADDING / Math.max((x1 - x0) / MAP_WIDTH, (y1 - y0) / MAP_HEIGHT),
  );
  const centerX = (x0 + x1) * HALF;
  const centerY = (y0 + y1) * HALF;
  const translateX = MAP_WIDTH * HALF - scale * centerX;
  const translateY = MAP_HEIGHT * HALF - scale * centerY;
  return `translate(${translateX},${translateY}) scale(${scale})`;
}

/** The --dur-zoom token in milliseconds (0 under prefers-reduced-motion). */
function zoomDuration(): number {
  const token = getComputedStyle(document.documentElement).getPropertyValue('--dur-zoom');
  return Number.parseFloat(token) || 0;
}

/**
 * Zoom the layer to `target`, or back out to the whole country when it's undefined.
 * @param layerRef the <g> that wraps every map path
 * @param target the selected state's shape
 */
export function useMapZoom(
  layerRef: RefObject<SVGGElement | null>,
  target: Feature<Geometry> | undefined,
): void {
  useEffect(() => {
    const layer = layerRef.current;
    if (layer === null) return;
    select(layer)
      .transition()
      .duration(zoomDuration())
      .ease(easeCubicOut)
      .attr('transform', target === undefined ? IDENTITY : fitTransform(target));
  }, [layerRef, target]);
}
