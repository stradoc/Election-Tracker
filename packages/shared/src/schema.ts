/**
 * schema.ts: the data shapes every layer agrees on.
 *
 * Pipeline position: the pipeline's normalize stage converts raw sources into these types,
 * the emit stage writes them as JSON, the server serves them unchanged, and the web app
 * renders them. If a shape changes, it changes here and nowhere else.
 */

/** Offices TippingPoint can show. Only offices listed in the registry have data. */
export type Office = 'president' | 'senate' | 'house' | 'governor' | 'state-legislature';

/** The geographic level a result row describes. */
export type GeoLevel = 'state' | 'county' | 'district';

/**
 * Votes in one place (a state, a county, or an electoral-vote district such as ME-2).
 *
 * Votes are split into Democratic, Republican and everyone else. Third-party candidates are
 * summed into `other` so margins stay comparable across years and states.
 */
export interface PlaceResult {
  /**
   * Stable geographic id.
   * - state: 2-digit FIPS, e.g. "42" (Pennsylvania)
   * - county: 5-digit FIPS, e.g. "42003" (Allegheny County, PA)
   * - district: state FIPS + "-" + district number, e.g. "23-2" (Maine's 2nd district)
   */
  geoId: string;
  level: GeoLevel;
  /** Display name, e.g. "Pennsylvania", "Allegheny County", "Maine 2nd District". */
  name: string;
  /** 2-digit FIPS of the state this place belongs to. */
  stateFips: string;
  dem: number;
  rep: number;
  other: number;
  /** All votes cast for the office in this place (dem + rep + other). */
  total: number;
  /**
   * Electoral votes this place awards (president only). States award their at-large votes
   * here; ME and NE districts award one each. Undefined for counties.
   */
  electoralVotes?: number;
}

/** Where a number came from. Every dataset carries the sources it was built from. */
export interface SourceRef {
  /** Key into SOURCES in sources.ts. */
  id: string;
  /** Dataset version or retrieval note, e.g. "Dataverse v10.1". */
  version: string;
}

/**
 * Demographics of one place (a state or a county), from the Census Bureau's American
 * Community Survey 5-year estimates. Shares are fractions (0.32 = 32%).
 *
 * This is "places" evidence: it describes who lives in a place, not how any group voted.
 * Comparing it with results shows how places with more of a group voted.
 */
export interface GeoProfile {
  /** Same ids as PlaceResult: 2-digit state FIPS or 5-digit county FIPS. */
  geoId: string;
  level: 'state' | 'county';
  name: string;
  stateFips: string;
  /** The ACS 5-year survey period, e.g. "2020–2024". */
  period: string;
  population: number;
  /** Citizens aged 18 and over (citizen voting-age population): the turnout denominator. */
  cvap: number;
  /** Shares of the whole population, by race and ethnicity. */
  whiteNonHispanic: number;
  blackNonHispanic: number;
  hispanic: number;
  asianNonHispanic: number;
  /** Share of adults 25 and over with a bachelor's degree or higher. */
  bachelorsOrHigher: number;
  /** In dollars of the survey's final year (see `period`); null where the Census suppresses it. */
  medianHouseholdIncome: number | null;
  medianAge: number | null;
}

/**
 * One data file as emitted by the pipeline and served by the API.
 * - scope "national": every state (plus ME/NE districts for presidential results).
 * - scope "state": every county in one state (`stateFips` is set).
 */
export interface Dataset<Place> {
  year: number;
  scope: 'national' | 'state';
  /** Set when scope is "state". */
  stateFips?: string;
  places: Place[];
  sources: SourceRef[];
}

/** Election results for one office in one year. */
export interface ResultsDataset extends Dataset<PlaceResult> {
  office: Office;
  /** Major-party nominees. For president these apply to every place. */
  candidates: { dem: string; rep: string };
}

/** Demographic profiles matched to one election year (the same for every office). */
export type ProfilesDataset = Dataset<GeoProfile>;

/**
 * What the pipeline produced for one election. The server answers only for elections
 * listed here, so the API never promises data that wasn't generated.
 */
export interface ManifestEntry {
  year: number;
  office: Office;
  /**
   * State FIPS codes that have a county-level results file. Empty when the county source
   * hasn't been downloaded yet (the map then shows states only).
   */
  countyStates: string[];
  /** Datasets generated for this election, e.g. ["results", "profiles"]. */
  datasets: string[];
}

/** data/processed/manifest.json: everything the pipeline generated in its last run. */
export interface Manifest {
  elections: ManifestEntry[];
}
