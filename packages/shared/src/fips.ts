/**
 * fips.ts: the 50 states plus DC, keyed by 2-digit Census FIPS code.
 *
 * Pipeline position: the shared geographic key. Results (MEDSL), boundaries (us-atlas) and
 * demographics (Census ACS) all use FIPS codes, which is what lets the pipeline join them.
 */

import noCountyLayer from '../data/no-county-layer.json' with { type: 'json' };

/** One state (or DC). */
export interface StateInfo {
  /** 2-digit FIPS code, zero-padded, e.g. "06". */
  fips: string;
  /** USPS postal abbreviation, e.g. "CA". */
  postal: string;
  name: string;
}

/** All 51 electoral jurisdictions, in FIPS order. */
export const STATES: readonly StateInfo[] = [
  { fips: '01', postal: 'AL', name: 'Alabama' },
  { fips: '02', postal: 'AK', name: 'Alaska' },
  { fips: '04', postal: 'AZ', name: 'Arizona' },
  { fips: '05', postal: 'AR', name: 'Arkansas' },
  { fips: '06', postal: 'CA', name: 'California' },
  { fips: '08', postal: 'CO', name: 'Colorado' },
  { fips: '09', postal: 'CT', name: 'Connecticut' },
  { fips: '10', postal: 'DE', name: 'Delaware' },
  { fips: '11', postal: 'DC', name: 'District of Columbia' },
  { fips: '12', postal: 'FL', name: 'Florida' },
  { fips: '13', postal: 'GA', name: 'Georgia' },
  { fips: '15', postal: 'HI', name: 'Hawaii' },
  { fips: '16', postal: 'ID', name: 'Idaho' },
  { fips: '17', postal: 'IL', name: 'Illinois' },
  { fips: '18', postal: 'IN', name: 'Indiana' },
  { fips: '19', postal: 'IA', name: 'Iowa' },
  { fips: '20', postal: 'KS', name: 'Kansas' },
  { fips: '21', postal: 'KY', name: 'Kentucky' },
  { fips: '22', postal: 'LA', name: 'Louisiana' },
  { fips: '23', postal: 'ME', name: 'Maine' },
  { fips: '24', postal: 'MD', name: 'Maryland' },
  { fips: '25', postal: 'MA', name: 'Massachusetts' },
  { fips: '26', postal: 'MI', name: 'Michigan' },
  { fips: '27', postal: 'MN', name: 'Minnesota' },
  { fips: '28', postal: 'MS', name: 'Mississippi' },
  { fips: '29', postal: 'MO', name: 'Missouri' },
  { fips: '30', postal: 'MT', name: 'Montana' },
  { fips: '31', postal: 'NE', name: 'Nebraska' },
  { fips: '32', postal: 'NV', name: 'Nevada' },
  { fips: '33', postal: 'NH', name: 'New Hampshire' },
  { fips: '34', postal: 'NJ', name: 'New Jersey' },
  { fips: '35', postal: 'NM', name: 'New Mexico' },
  { fips: '36', postal: 'NY', name: 'New York' },
  { fips: '37', postal: 'NC', name: 'North Carolina' },
  { fips: '38', postal: 'ND', name: 'North Dakota' },
  { fips: '39', postal: 'OH', name: 'Ohio' },
  { fips: '40', postal: 'OK', name: 'Oklahoma' },
  { fips: '41', postal: 'OR', name: 'Oregon' },
  { fips: '42', postal: 'PA', name: 'Pennsylvania' },
  { fips: '44', postal: 'RI', name: 'Rhode Island' },
  { fips: '45', postal: 'SC', name: 'South Carolina' },
  { fips: '46', postal: 'SD', name: 'South Dakota' },
  { fips: '47', postal: 'TN', name: 'Tennessee' },
  { fips: '48', postal: 'TX', name: 'Texas' },
  { fips: '49', postal: 'UT', name: 'Utah' },
  { fips: '50', postal: 'VT', name: 'Vermont' },
  { fips: '51', postal: 'VA', name: 'Virginia' },
  { fips: '53', postal: 'WA', name: 'Washington' },
  { fips: '54', postal: 'WV', name: 'West Virginia' },
  { fips: '55', postal: 'WI', name: 'Wisconsin' },
  { fips: '56', postal: 'WY', name: 'Wyoming' },
];

/** State FIPS codes are two digits, zero-padded ("06"). */
const STATE_FIPS_DIGITS = 2;

const BY_FIPS = new Map(STATES.map((s) => [s.fips, s]));
const BY_POSTAL = new Map(STATES.map((s) => [s.postal, s]));

/**
 * Look up a state by FIPS code. Accepts unpadded input ("6" or 6) because some sources
 * store FIPS as numbers and drop the leading zero.
 */
export function stateByFips(fips: string | number): StateInfo | undefined {
  return BY_FIPS.get(String(fips).padStart(STATE_FIPS_DIGITS, '0'));
}

/** Look up a state by USPS postal abbreviation ("PA"). */
export function stateByPostal(postal: string): StateInfo | undefined {
  return BY_POSTAL.get(postal.toUpperCase());
}

/**
 * States that have no county-level results, keyed by FIPS, with the reason in plain words.
 * The pipeline skips their county rows; the map shows the reason instead of a county view.
 */
export const NO_COUNTY_LAYER: Readonly<Record<string, string>> = noCountyLayer.states;
