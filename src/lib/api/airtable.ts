/**
 * Airtable API client for AIP Platform frontend.
 * Calls the FastAPI /airtable/* endpoints (not Airtable directly —
 * the API key stays server-side).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AirtableProject {
  record_id: string;
  aip_project_id: string | null;
  project_name: string | null;
  country: string | null;
  region_city: string | null;
  sector: string | null;
  project_type: string | null;
  extra_fields: Record<string, unknown>;
}

export interface AirtableProjectsResponse {
  total: number;
  cached: boolean;
  projects: AirtableProject[];
}

export interface AirtableFilters {
  country?: string;
  sector?: string;
  project_type?: string;
  refresh?: boolean;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
async function airtableGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/airtable${path}`, {
    headers: { "Content-Type": "application/json" },
    next: { revalidate: 300 }, // Next.js 14 cache: 5 min
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? `Airtable API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all projects from Airtable (via backend cache).
 * Optionally filter by country, sector, or project_type.
 */
export async function getAirtableProjects(
  filters?: AirtableFilters
): Promise<AirtableProjectsResponse> {
  const params = new URLSearchParams();
  if (filters?.country) params.set("country", filters.country);
  if (filters?.sector) params.set("sector", filters.sector);
  if (filters?.project_type) params.set("project_type", filters.project_type);
  if (filters?.refresh) params.set("refresh", "true");

  const qs = params.toString() ? `?${params.toString()}` : "";
  return airtableGet<AirtableProjectsResponse>(`/projects${qs}`);
}

/**
 * Fetch a single Airtable project by its record ID.
 */
export async function getAirtableProject(recordId: string): Promise<AirtableProject> {
  return airtableGet<AirtableProject>(`/projects/${recordId}`);
}

/**
 * Search Airtable projects by name, project ID, or country.
 */
export async function searchAirtableProjects(
  query: string
): Promise<AirtableProjectsResponse> {
  return airtableGet<AirtableProjectsResponse>(
    `/projects/search/${encodeURIComponent(query)}`
  );
}

/**
 * Returns Airtable integration metadata (no secrets exposed).
 */
export async function getAirtableMeta(): Promise<{
  configured: boolean;
  base_id: string;
  projects_table: string;
  cache_ttl_seconds: number;
}> {
  return airtableGet("/meta");
}
