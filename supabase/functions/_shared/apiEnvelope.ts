import { corsHeaders } from './cors.ts';

export interface ApiError {
  code: string;
  message: string;
}
export interface ApiMeta {
  generatedAt?: string;
  nextCursor?: string;
  warnings?: string[];
  [key: string]: unknown;
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: ApiError | null;
  meta?: ApiMeta;
}

function headers(extra?: HeadersInit): Headers {
  const headers = new Headers({
    ...corsHeaders,
    'Content-Type': 'application/json',
  });
  if (extra) new Headers(extra).forEach((value, key) => headers.set(key, value));
  return headers;
}

export function successEnvelope<T>(
  data: T,
  options: { status?: number; meta?: ApiMeta; headers?: HeadersInit } = {},
): Response {
  const meta = { generatedAt: new Date().toISOString(), ...options.meta };
  const body: ApiEnvelope<T> = { data, error: null, meta };
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: headers(options.headers),
  });
}

export function errorEnvelope(
  code: string,
  message: string,
  status = 400,
  options: { meta?: ApiMeta; headers?: HeadersInit } = {},
): Response {
  const meta = { generatedAt: new Date().toISOString(), ...options.meta };
  const body: ApiEnvelope<never> = { data: null, error: { code, message }, meta };
  return new Response(JSON.stringify(body), {
    status,
    headers: headers(options.headers),
  });
}
