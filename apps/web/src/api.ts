const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(API_URL + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new ApiError(payload.error?.message ?? 'Request failed', response.status);
  }
  return payload.data as T;
}

export const mutations = {
  create: (resource: string, data: unknown) =>
    api(resource, { method: 'POST', body: JSON.stringify(data) }),
  update: (resource: string, id: string, data: unknown) =>
    api(resource + '/' + id, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (resource: string, id: string) => api(resource + '/' + id, { method: 'DELETE' }),
};
