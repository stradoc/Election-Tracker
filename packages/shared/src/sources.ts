/**
 * sources.ts: every dataset TippingPoint uses, with its publisher, license and pinned version.
 *
 * Pipeline position: the single list of where data comes from. The pipeline's source
 * modules read download details (DOI, version, file name) from here. The web app's Sources
 * section renders credits from here. Each emitted dataset lists the source ids it was built
 * from, so any number on screen can be traced back to a row in this file.
 */

/** Metadata for one upstream dataset. */
export interface SourceInfo {
  readonly id: string;
  readonly title: string;
  readonly publisher: string;
  /** Human-readable landing page. */
  readonly url: string;
  readonly license: string;
  /**
   * For Harvard Dataverse sources: the dataset DOI, the pinned dataset version, and the file
   * to fetch. Pinning the version keeps the pipeline reproducible when MEDSL publishes
   * updates; bump it deliberately and re-run the pipeline.
   */
  readonly dataverse?: {
    readonly doi: string;
    readonly version: string;
    readonly fileName: string;
    /**
     * True when Dataverse requires a guestbook form before download. A script can't fill
     * that in without sending someone's personal details, so the pipeline asks the owner to
     * download the file once by hand into data/raw/<source id>/.
     */
    readonly guestbook: boolean;
  };
  readonly notes?: string;
}

/** All sources, keyed by id. */
export const SOURCES = {
  'medsl-president-state': {
    id: 'medsl-president-state',
    title: 'U.S. President 1976–2024',
    publisher: 'MIT Election Data and Science Lab',
    url: 'https://doi.org/10.7910/DVN/42MVDX',
    license: 'CC0 1.0',
    dataverse: {
      doi: 'doi:10.7910/DVN/42MVDX',
      version: '10.1',
      fileName: '1976-2024-president.csv',
      guestbook: false,
    },
  },
  'medsl-president-county': {
    id: 'medsl-president-county',
    title: 'County Presidential Election Returns 2000–2024',
    publisher: 'MIT Election Data and Science Lab',
    url: 'https://doi.org/10.7910/DVN/VOQCHQ',
    license: 'CC0 1.0',
    dataverse: {
      doi: 'doi:10.7910/DVN/VOQCHQ',
      version: '20.0',
      fileName: 'countypres_2000-2024.csv',
      guestbook: true,
    },
  },
  'ev-districts': {
    id: 'ev-districts',
    title: 'Presidential results by congressional district, Maine and Nebraska',
    publisher: 'Maine Secretary of State; Nebraska Secretary of State (certified results)',
    url: 'https://www.maine.gov/sos/cec/elec/results/',
    license: 'Public record',
    notes:
      "Curated by hand in scripts/data/sources/ev-districts.ts because MEDSL's state file " +
      'has no district rows. Each figure cites the certified canvass it came from.',
  },
  'census-acs5': {
    id: 'census-acs5',
    title: 'American Community Survey 5-year estimates',
    publisher: 'U.S. Census Bureau (via the Census Data API)',
    url: 'https://www.census.gov/programs-surveys/acs',
    license: 'Public domain (U.S. government work)',
    notes:
      'Variables and survey periods are listed in scripts/data/src/sources/acs.json. ' +
      'Needs a free API key in scripts/data/.env (CENSUS_API_KEY).',
  },
  'us-atlas': {
    id: 'us-atlas',
    title: 'us-atlas v3 (counties-albers-10m)',
    publisher: 'Mike Bostock, from U.S. Census Bureau cartographic boundary files',
    url: 'https://github.com/topojson/us-atlas',
    license: 'ISC (boundaries: U.S. Census Bureau, public domain)',
  },
} as const satisfies Record<string, SourceInfo>;

/** Id of any source in SOURCES. */
export type SourceId = keyof typeof SOURCES;
