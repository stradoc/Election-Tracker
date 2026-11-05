/**
 * index.ts: public entry point of @tippingpoint/shared.
 *
 * Everything the pipeline, server and web app share is re-exported from here, so other
 * packages import from "@tippingpoint/shared" and never reach into individual files.
 */

export * from './schema.ts';
export * from './fips.ts';
export * from './ev-tables.ts';
export * from './margins.ts';
export * from './swing.ts';
export * from './electoral.ts';
export * from './scenario.ts';
export * from './sources.ts';
export * from './registry.ts';
export * from './dev-config.ts';
export * from './turnout.ts';
