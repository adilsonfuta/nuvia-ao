// Keep API calls on the web origin so the session cookie works both on
// localhost and 127.0.0.1. Next.js proxies this path to the API server.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof result?.message === 'string' ? result.message : Array.isArray(result?.message) ? result.message.join(', ') : 'Não foi possível concluir o pedido.';
    throw new ApiError(message, response.status);
  }
  return result as T;
}
