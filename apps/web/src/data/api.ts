/**
 * api.ts: how the web app gets data. Every request goes through these hooks.
 *
 * Web position: the boundary between the app and the API server (apps/server). Results
 * are historical and never change, so each one is fetched once per visit and cached by
 * TanStack Query. When live data arrives (Phase 6), polling is configured here, not in
 * components.
 */

import { useQuery } from '@tanstack/react-query';
import type {
  DatasetId,
  ElectionEntry,
  Office,
  ProfilesDataset,
  ResultsDataset,
} from '@tippingpoint/shared';

/** An election the API can serve, with the states that have county files. */
export interface ElectionListing extends ElectionEntry {
  readonly countyStates: readonly string[];
  /** Datasets generated for it, e.g. ["results", "profiles"]. */
  readonly datasets: readonly DatasetId[];
}

/** A failed API request, with the HTTP status so callers can tell "missing" from "broken". */
export class ApiError extends Error {
  override name = 'ApiError';
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const HTTP_NOT_FOUND = 404;
/** Network hiccups get this many retries. Missing data (404) is never retried. */
const MAX_RETRIES = 2;

/** GET a JSON endpoint, throwing ApiError with the server's message on failure. */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(response.status, body.message ?? `${url} failed (${response.status})`);
  }
  return (await response.json()) as T;
}

/** Retry policy shared by every query. */
function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status === HTTP_NOT_FOUND) return false;
  return failureCount < MAX_RETRIES;
}

/** True when an error means "this data wasn't generated", not "something broke". */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === HTTP_NOT_FOUND;
}

/** Every election the API can serve, newest first. */
export function useElections() {
  return useQuery({
    queryKey: ['elections'],
    queryFn: () => fetchJson<ElectionListing[]>('/api/elections'),
    staleTime: Infinity,
    retry: shouldRetry,
  });
}

/**
 * Any dataset for one election: the national file, or one state's counties. Every
 * dataset hook below is this one with a type; new datasets need no new fetching code.
 * @param stateFips omit for the national file; set for that state's counties
 * @param enabled pass false to wait (e.g. until the user opens a state)
 */
function useDataset<T>(
  dataset: DatasetId,
  year: number,
  office: Office,
  stateFips: string | undefined,
  enabled: boolean,
) {
  const suffix = stateFips === undefined ? '' : `/${stateFips}`;
  return useQuery({
    queryKey: [dataset, year, office, stateFips ?? 'national'],
    queryFn: () => fetchJson<T>(`/api/${year}/${office}/${dataset}${suffix}`),
    staleTime: Infinity,
    retry: shouldRetry,
    enabled,
  });
}

/** Election results: states + ME/NE districts, or one state's counties. */
export function useResults(year: number, office: Office, stateFips?: string, enabled = true) {
  return useDataset<ResultsDataset>('results', year, office, stateFips, enabled);
}

/** ACS demographic profiles matched to the election year: states, or one state's counties. */
export function useProfiles(year: number, office: Office, stateFips?: string, enabled = true) {
  return useDataset<ProfilesDataset>('profiles', year, office, stateFips, enabled);
}
