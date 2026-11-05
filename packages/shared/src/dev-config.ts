/**
 * dev-config.ts: local development settings shared by the server and the web dev server.
 *
 * The API server listens on this port unless PORT is set in apps/server/.env, and Vite
 * proxies /api requests to it. Keeping it here means the two can't drift apart.
 */

/** Default port for the API server in development. */
export const DEFAULT_API_PORT = 8787;
