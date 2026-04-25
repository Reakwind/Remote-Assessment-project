import { edgeAnonHeaders, edgeFn, supabase } from './supabase';

export async function getClinicianToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function callClinicianFunction<T>(name: string, init: RequestInit = {}): Promise<T> {
  const token = await getClinicianToken();
  if (!token) throw new Error('Clinician is not authenticated');

  const res = await fetch(edgeFn(name), {
    ...init,
    headers: {
      ...edgeAnonHeaders,
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.error ?? text;
    } catch {
      // Keep the raw response for non-JSON errors.
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}
