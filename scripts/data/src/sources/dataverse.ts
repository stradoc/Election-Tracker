/**
 * dataverse.ts: download one file from a Harvard Dataverse dataset at a pinned version.
 *
 * Pipeline position: stage 1 (sources). Used by every MEDSL source. It only fetches raw
 * bytes into data/raw/<source id>/ and never parses them; that happens in normalize/.
 *
 * Files that sit behind a Dataverse guestbook form can't be fetched by a script without
 * sending personal details, so for those this prints manual download steps instead.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SourceInfo } from '@tippingpoint/shared';
import { rawDirFor } from '../paths.ts';

const DATAVERSE_API = 'https://dataverse.harvard.edu/api';

/** The parts of Dataverse's dataset-version response we use. */
interface DataverseVersionResponse {
  status: string;
  data?: {
    files: Array<{
      dataFile: { id: number; filename: string; originalFileName?: string };
    }>;
  };
}

/** Thrown when a file needs the owner to download it by hand (guestbook-protected). */
export class ManualDownloadRequired extends Error {
  override name = 'ManualDownloadRequired';
}

/**
 * Make sure a Dataverse source's file is in data/raw/<source id>/.
 * Already-downloaded files are reused, so re-running the pipeline is fast and offline.
 *
 * @returns absolute path of the local file
 * @throws ManualDownloadRequired for guestbook-protected files that aren't present yet
 */
export async function fetchDataverseFile(source: SourceInfo): Promise<string> {
  const spec = source.dataverse;
  if (spec === undefined) throw new Error(`${source.id} is not a Dataverse source`);

  const target = path.join(rawDirFor(source.id), spec.fileName);
  if (existsSync(target)) return target;

  if (spec.guestbook) {
    throw new ManualDownloadRequired(
      [
        `${source.id}: this file sits behind Dataverse's guestbook form, so download it once by hand:`,
        `  1. Open ${source.url}`,
        `  2. Download "${spec.fileName}" (choose "Original File Format" / CSV if asked) and`,
        '     fill in the guestbook form.',
        `  3. Save it as: ${target}`,
        '  4. Re-run: npm run data',
      ].join('\n'),
    );
  }

  const fileId = await resolveFileId(spec.doi, spec.version, spec.fileName);
  // format=original returns the uploaded CSV instead of Dataverse's tab-separated copy.
  const url = `${DATAVERSE_API}/access/datafile/${fileId}?format=original`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${source.id}: download failed (${response.status}) ${url}`);

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return target;
}

/**
 * Find a file's numeric id inside a pinned dataset version. Ids change between versions,
 * so the pipeline looks them up by file name instead of hard-coding them.
 */
async function resolveFileId(doi: string, version: string, fileName: string): Promise<number> {
  const url = `${DATAVERSE_API}/datasets/:persistentId/versions/${version}?persistentId=${doi}`;
  const response = await fetch(url);
  const body = (await response.json()) as DataverseVersionResponse;
  if (body.status !== 'OK' || body.data === undefined) {
    throw new Error(`Dataverse lookup failed for ${doi} v${version}: ${JSON.stringify(body)}`);
  }
  const match = body.data.files.find(
    (f) => f.dataFile.filename === fileName || f.dataFile.originalFileName === fileName,
  );
  if (match === undefined) {
    throw new Error(`${fileName} not found in ${doi} v${version}`);
  }
  return match.dataFile.id;
}
