export interface AirtableProject {
  id: string;
    name: string;
      description?: string;
        location?: string;
          status?: string;
            sector?: string;
              budget?: number;
                startDate?: string;
                  endDate?: string;
                    images?: string[];
                    }

                    export interface AirtableProjectsResponse {
                      records: AirtableProject[];
                        hasMore: boolean;
                          offset?: string;
                          }

                          export interface AirtableFilters {
                            status?: string;
                              sector?: string;
                                minBudget?: number;
                                  maxBudget?: number;
                                    country?: string;
                                    }

                                    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                                    const CACHE_DURATION = 300; // 5 minutes

                                    async function airtableGet<T>(path: string): Promise<T> {
                                      const url = `${API_BASE_URL}${path}`;
                                        const res = await fetch(url, {
                                            headers: {
                                                  'Content-Type': 'application/json',
                                                      },
                                                          next: { revalidate: CACHE_DURATION },
                                                            });

                                                              if (!res.ok) {
                                                                  throw new Error(`Airtable API error: ${res.statusText}`);
                                                                    }

                                                                      return res.json();
                                                                      }

                                                                      export async function getAirtableProjects(
                                                                        filters?: AirtableFilters
                                                                        ): Promise<AirtableProjectsResponse> {
                                                                          const params = new URLSearchParams();

                                                                              if (filters?.status) params.append('status', filters.status);
                                                                                if (filters?.sector) params.append('sector', filters.sector);
                                                                                  if (filters?.minBudget) params.append('min_budget', filters.minBudget.toString());
                                                                                    if (filters?.maxBudget) params.append('max_budget', filters.maxBudget.toString());
                                                                                      if (filters?.country) params.append('country', filters.country);

                                                                                        const query = params.toString() ? `?${params.toString()}` : '';
                                                                                          return airtableGet<AirtableProjectsResponse>(`/api/airtable/projects${query}`);
                                                                                          }

                                                                                          export async function getAirtableProject(recordId: string): Promise<AirtableProject> {
                                                                                            return airtableGet<AirtableProject>(`/api/airtable/projects/${recordId}`);
                                                                                            }

                                                                                            export async function searchAirtableProjects(query: string): Promise<AirtableProjectsResponse> {
                                                                                              const params = new URLSearchParams({ q: query });
                                                                                                return airtableGet<AirtableProjectsResponse>(`/api/airtable/projects/search?${params.toString()}`);
                                                                                                }
