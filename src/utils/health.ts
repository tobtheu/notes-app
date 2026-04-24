/**
 * Connectivity & Health checks for the application services.
 */

export interface HealthStatus {
  service: 'Supabase' | 'Electric' | 'Internet';
  ok: boolean;
  url?: string;
  error?: string;
  latency?: number;
}

/**
 * Pings a URL to check if it's reachable.
 */
async function ping(url: string): Promise<{ ok: boolean; latency: number; error?: string }> {
  const start = Date.now();
  try {
    // We use 'no-cache' and a short timeout to avoid hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await fetch(url, { 
      method: 'HEAD', 
      mode: 'no-cors', // Important for cross-origin pings if no CORS headers
      cache: 'no-cache',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return { ok: true, latency: Date.now() - start };
  } catch (err) {
    return { 
      ok: false, 
      latency: -1, 
      error: err instanceof Error ? err.message : String(err) 
    };
  }
}

/**
 * Runs a full diagnostic of required services.
 */
export async function runDiagnostics(): Promise<HealthStatus[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const electricUrl = import.meta.env.VITE_ELECTRIC_URL;

  const results: HealthStatus[] = [];

  // 1. Internet Check
  const googlePing = await ping('https://www.google.com');
  results.push({ service: 'Internet', ok: googlePing.ok, error: googlePing.error });

  // 2. Supabase Check
  if (supabaseUrl) {
    const sPing = await ping(supabaseUrl);
    results.push({ 
      service: 'Supabase', 
      ok: sPing.ok, 
      url: supabaseUrl, 
      error: sPing.error, 
      latency: sPing.latency 
    });
  }

  // 3. Electric Check
  if (electricUrl) {
    // Electric health check endpoint is usually /v1/health or just the root
    const ePing = await ping(`${electricUrl}/v1/health`);
    results.push({ 
      service: 'Electric', 
      ok: ePing.ok, 
      url: electricUrl, 
      error: ePing.error, 
      latency: ePing.latency 
    });
  }

  return results;
}
