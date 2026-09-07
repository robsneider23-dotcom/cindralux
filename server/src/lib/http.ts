import { lookup } from 'node:dns';
import { isIP, type LookupFunction } from 'node:net';
import { Agent } from 'undici';
import ipaddr from 'ipaddr.js';
import { redactUrls, redactSecrets } from './redact.ts';

/** Metadaten-, Link-local-, Multicast- und unbestimmte Adressen sind nie Ziele. */
export function addressAllowed(address: string, allowPrivate: boolean): boolean {
  try {
    const parsed = ipaddr.process(address);
    const range = parsed.range();
    return range === 'unicast' || (allowPrivate && ['private', 'loopback', 'uniqueLocal'].includes(range));
  } catch { return false; }
}

function privateAllowed(hostname: string, configured: boolean): boolean {
  return configured || (process.env.DASHBOARD_FETCH_HOSTS ?? '').split(',').map((host) => host.trim().toLowerCase()).includes(hostname.toLowerCase());
}

function guardedLookup(configured: boolean): LookupFunction {
  return (hostname, options, callback) => {
    // Die geprüften IPs gehen direkt an den Socket: keine zweite DNS-Auflösung.
    lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) { callback(error, ''); return; }
      const permitted = privateAllowed(hostname, configured);
      if (!addresses.length || addresses.some((entry) => !addressAllowed(entry.address, permitted))) {
        callback(new Error('Netzwerkziel nicht erlaubt.'), '');
        return;
      }
      if (options.all) callback(null, addresses);
      else callback(null, addresses[0]!.address, addresses[0]!.family);
    });
  };
}
const publicAgent = new Agent({ connect: { lookup: guardedLookup(false) }, connections: 8 });
export const configuredAgent = new Agent({ connect: { lookup: guardedLookup(true) }, connections: 8, webSocket: { maxPayloadSize: 8 * 1024 * 1024, maxFragments: 4096 } });

export function safeHttpUrl(raw: string, allowPrivate = false): URL {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Nur HTTP(S)-Adressen ohne eingebettete Zugangsdaten erlaubt.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) && !addressAllowed(host, privateAllowed(host, allowPrivate))) throw new Error('Netzwerkziel nicht erlaubt.');
  return url;
}

/** Timeout umfasst auch den Body. Größe wird nach Dekompression begrenzt. */
export async function fetchWithTimeout(
  rawUrl: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
  options: { allowPrivate?: boolean; maxBytes?: number } = {},
): Promise<Response> {
  let url = safeHttpUrl(rawUrl, options.allowPrivate ?? false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const allowPrivate = options.allowPrivate ?? false;
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  let method = init.method ?? 'GET';
  let body = init.body;
  const headers = new Headers(init.headers);
  try {
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response = await fetch(url, {
        ...init, method, body, headers, redirect: 'manual',
        signal: init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal,
        dispatcher: allowPrivate ? configuredAgent : publicAgent,
      } as RequestInit);
      if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.has('location')) {
        await response.body?.cancel();
        if (redirects === 5) throw new Error('Zu viele Weiterleitungen.');
        const next = safeHttpUrl(new URL(response.headers.get('location')!, url).href, allowPrivate);
        if (url.protocol === 'https:' && next.protocol !== 'https:') throw new Error('Unsichere Weiterleitung blockiert.');
        if (next.origin !== url.origin) {
          // Auch POST-Bodies können Keys enthalten (z.B. OAuth-Token-Anfragen).
          if (headers.has('authorization') || headers.has('cookie') || body) throw new Error('Weiterleitung mit Zugangsdaten blockiert.');
        }
        if (response.status === 303 || ((response.status === 301 || response.status === 302) && method.toUpperCase() === 'POST')) {
          method = 'GET'; body = undefined;
          headers.delete('content-type'); headers.delete('content-length');
        }
        url = next;
        continue;
      }
      if (Number(response.headers.get('content-length')) > maxBytes) {
        await response.body?.cancel();
        throw new Error('Antwort ist zu groß.');
      }
      const chunks: Uint8Array[] = [];
      let size = 0;
      const reader = response.body?.getReader();
      if (reader) {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maxBytes) { await reader.cancel(); throw new Error('Antwort ist zu groß.'); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
      }
      const resultHeaders = new Headers(response.headers);
      resultHeaders.delete('content-encoding'); resultHeaders.delete('content-length');
      return new Response([204, 205, 304].includes(response.status) || method === 'HEAD' ? null : Buffer.concat(chunks), {
        status: response.status, statusText: response.statusText, headers: resultHeaders,
      });
    }
    throw new Error('Zu viele Weiterleitungen.');
  } finally { clearTimeout(timer); }
}

/** Keine URLs oder typische Schlüssel in Fehlermeldungen und Logs. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'Zeitueberschreitung';
    if (error.message.includes('ENOTFOUND')) return 'Host nicht erreichbar';
    if (error.message.includes('ECONNREFUSED')) return 'Verbindung abgelehnt';
  }
  return redactUrls(redactSecrets(error instanceof Error ? error.message : String(error)))
    .replace(/\bBearer\s+\S+/gi, 'Bearer [entfernt]')
    .replace(/\bsk-[a-zA-Z0-9_-]+/g, '[Schlüssel entfernt]')
    .slice(0, 500);
}
