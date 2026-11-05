/**
 * dataset.ts: the API routes.
 *
 * Server position: the only HTTP surface.
 *   GET /api/elections                          registry ∩ manifest: what the app can show
 *   GET /api/:year/:office/:dataset             national file (states, + ME/NE districts)
 *   GET /api/:year/:office/:dataset/:stateFips  one state's counties
 * Datasets today: results, profiles (ACS demographics; the same for every office in a
 * year). New datasets (turnout, groups, polls) are new DATASET_INFO entries in the shared
 * registry, not new routes.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  DATASETS,
  ELECTIONS,
  findElection,
  stateByFips,
  type DatasetId,
  type Office,
} from '@tippingpoint/shared';
import type { DataProvider } from '../providers/DataProvider.ts';

/** Historical results never change, so browsers and CDNs may cache them for a day. */
const CACHE_SECONDS = 86_400;

/** HTTP statuses the routes send. */
const HTTP_NOT_FOUND = 404;

/** Path parameters as Fastify hands them over (always strings). */
interface DatasetParams {
  year: string;
  office: string;
  dataset: string;
  stateFips?: string;
}

/** Send a 404 with a message that says exactly what wasn't found. */
function notFound(reply: FastifyReply, message: string): FastifyReply {
  return reply.code(HTTP_NOT_FOUND).send({ error: 'not_found', message });
}

/** Whether a string is one of the registered dataset ids. */
function isDatasetId(value: string): value is DatasetId {
  return (DATASETS as readonly string[]).includes(value);
}

/** Register all API routes on a Fastify instance. */
export function registerRoutes(app: FastifyInstance, provider: DataProvider): void {
  app.get('/api/elections', async () => {
    const manifest = await provider.manifest();
    return ELECTIONS.flatMap((election) => {
      const generated = manifest.elections.find(
        (entry) => entry.year === election.year && entry.office === election.office,
      );
      return generated === undefined
        ? []
        : [{ ...election, countyStates: generated.countyStates, datasets: generated.datasets }];
    });
  });

  const handler = async (request: { params: DatasetParams }, reply: FastifyReply) => {
    const { year, office, dataset, stateFips } = request.params;
    const election = findElection(Number(year), office as Office);
    if (election === undefined)
      return notFound(reply, `No election registered for ${year} ${office}`);
    if (!isDatasetId(dataset)) return notFound(reply, `Unknown dataset "${dataset}"`);
    if (stateFips !== undefined && stateByFips(stateFips)?.fips !== stateFips) {
      return notFound(reply, `Unknown state FIPS "${stateFips}" (use two digits, e.g. "06")`);
    }

    const data = await provider.dataset({
      year: election.year,
      office: election.office,
      dataset,
      stateFips,
    });
    if (data === undefined) {
      return notFound(
        reply,
        `${dataset} for ${year} ${office}${stateFips ? ` state ${stateFips}` : ''} has not been generated. Run npm run data.`,
      );
    }
    return reply.header('cache-control', `public, max-age=${CACHE_SECONDS}`).send(data);
  };

  app.get<{ Params: DatasetParams }>('/api/:year/:office/:dataset', handler);
  app.get<{ Params: DatasetParams }>('/api/:year/:office/:dataset/:stateFips', handler);
}
