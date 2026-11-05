/**
 * geometry.ts: state and county shapes for the map, loaded once per visit.
 *
 * Web position: the "boundaries" third of results + boundaries + demographics. Shapes come
 * from us-atlas's counties-albers-10m file, which is already projected (Albers USA, with
 * Alaska and Hawaii moved into insets) into a 975 × 610 frame. So the path generator needs
 * no projection, and shape ids are the same FIPS codes the pipeline uses.
 */

import { useQuery } from '@tanstack/react-query';
import { geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

/** Width and height of the pre-projected us-atlas frame, in SVG units. */
export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 610;

/** The first two digits of a county id are its state's id ("42003" → "42"). */
const STATE_FIPS_DIGITS = 2;

/** A drawable shape: its FIPS id, display name, SVG path, and the GeoJSON for zooming. */
export interface MapShape {
  readonly id: string;
  readonly name: string;
  readonly d: string;
  readonly feature: Feature<Geometry>;
}

/** Everything the map draws. Counties are grouped by state so only one state's are drawn. */
export interface MapGeometry {
  readonly states: readonly MapShape[];
  readonly countiesByState: ReadonlyMap<string, readonly MapShape[]>;
}

type UsAtlas = Topology<{
  states: GeometryCollection<{ name: string }>;
  counties: GeometryCollection<{ name: string }>;
  nation: GeometryCollection;
}>;

/** Path generator for already-projected coordinates (identity projection). */
export const mapPath = geoPath();

/** Convert one TopoJSON layer into drawable shapes. */
function shapesOf(topology: UsAtlas, layer: 'states' | 'counties'): MapShape[] {
  const collection = feature(topology, topology.objects[layer]);
  return collection.features.map((f) => ({
    id: String(f.id),
    name: f.properties?.name ?? String(f.id),
    d: mapPath(f) ?? '',
    feature: f,
  }));
}

/** Load the boundary file (a separate ~800 KB chunk, fetched on first use) and prepare shapes. */
async function loadGeometry(): Promise<MapGeometry> {
  const module = await import('us-atlas/counties-albers-10m.json');
  const topology = module.default as unknown as UsAtlas;
  const counties = shapesOf(topology, 'counties');
  return {
    states: shapesOf(topology, 'states'),
    countiesByState: Map.groupBy(counties, (county) => county.id.slice(0, STATE_FIPS_DIGITS)),
  };
}

/** Map shapes, loaded once and shared by every component that needs them. */
export function useGeometry() {
  return useQuery({ queryKey: ['geometry'], queryFn: loadGeometry, staleTime: Infinity });
}
