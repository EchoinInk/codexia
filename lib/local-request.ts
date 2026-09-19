import { FileConflictError, getWorkspaceRoot } from "./fs-safe";

export class RequestError extends Error {
  constructor(message: string, readonly status: number = 400) { super(message); }
}

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Local browser boundary, not CORS or authentication for remote deployment. */
export async function localMutationBody(request: Request): Promise<Record<string, unknown>> {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  // Next may normalize its internal request URL to localhost even when the
  // browser uses 127.0.0.1. Validate the actual Host authority independently.
  let authority: URL;
  try { authority = host ? new URL(`${url.protocol}//${host}`) : url; }
  catch { throw new RequestError("Local host required", 403); }
  if (!localHosts.has(url.hostname) || !localHosts.has(authority.hostname) || authority.port !== url.port ||
    (host && authority.host !== host)) throw new RequestError("Local host required", 403);
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if ((origin && origin !== authority.origin) || (site && site !== "same-origin" && site !== "none")) {
    throw new RequestError("Origin mismatch", 403);
  }
  // Browser requests need an Origin; origin-less local host integrations remain supported.
  if (site && !origin) throw new RequestError("Origin required for browser mutations", 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestError("application/json required", 415);
  }
  let body: unknown;
  try { body = await request.json(); } catch { throw new RequestError("Invalid JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestError("JSON object required");
  return body as Record<string, unknown>;
}

export function requestFilePath(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new RequestError("A nonempty file path is required");
  return value;
}

/** HTTP selects only the configured workspace; programmatic adapters remain explicit. */
export function configuredRequestWorkspace(requested?: unknown): string {
  const workspace = getWorkspaceRoot();
  if (requested !== undefined && (typeof requested !== "string" || !requested.trim() || getWorkspaceRoot(requested) !== workspace)) {
    throw new RequestError("Request workspace differs from configured workspace");
  }
  return workspace;
}

export function fileErrorResponse(error: unknown): Response {
  const code = (error as NodeJS.ErrnoException)?.code;
  const status = error instanceof RequestError ? error.status : error instanceof FileConflictError ? 409
    : code === "ENOENT" ? 404 : code === "EACCES" || code === "EPERM" ? 403 : 400;
  return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status });
}
