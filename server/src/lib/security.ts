import { createHash, timingSafeEqual } from 'node:crypto';
import { hostname, networkInterfaces } from 'node:os';
import type { Request, RequestHandler } from 'express';

export function isLoopback(address = ''): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export interface SecurityOptions {
  password?: string;
  /** Explizite externe HTTPS-Adresse; der TLS-Proxy muss auf Loopback laufen. */
  origin?: string;
}

export function createAccessControl(options: SecurityOptions = {}): RequestHandler {
  const password = options.password || '';
  if (password && password.length < 20) throw new Error('DASHBOARD_PASSWORD muss mindestens 20 Zeichen lang sein.');
  const external = options.origin ? new URL(options.origin) : null;
  if (external && (external.protocol !== 'https:' || external.username || external.password || external.pathname !== '/' || external.search || external.hash)) {
    throw new Error('DASHBOARD_ORIGIN muss eine reine HTTPS-Origin sein.');
  }
  const hosts = new Set(['localhost', '127.0.0.1', '::1', hostname().toLowerCase(), `${hostname().toLowerCase()}.local`]);
  for (const entries of Object.values(networkInterfaces())) for (const entry of entries ?? []) hosts.add(entry.address.toLowerCase());
  if (external) hosts.add(external.hostname.replace(/^\[|\]$/g, '').toLowerCase());
  const passwordHash = createHash('sha256').update(password).digest();
  const failures = new Map<string, { count: number; until: number }>();

  return (req, res, next) => {
    let host: URL;
    try {
      host = new URL(`http://${req.headers.host}`);
      if (!req.headers.host || host.username || host.password || host.pathname !== '/' || host.search || host.hash || !hosts.has(host.hostname.replace(/^\[|\]$/g, '').toLowerCase())) throw new Error();
    } catch {
      res.status(403).json({ error: 'Nicht erlaubter Host.' });
      return;
    }
    const localPeer = isLoopback(req.socket.remoteAddress);
    const forwarded = Object.keys(req.headers).some((name) => name === 'forwarded' || name.startsWith('x-forwarded-'));
    const local = localPeer && !forwarded && ['localhost', '127.0.0.1', '[::1]'].includes(host.hostname.toLowerCase());
    // Kein Vertrauen in beliebige Forwarded-Header. Nur der lokale TLS-Proxy
    // an der explizit konfigurierten Origin darf das Transportprotokoll melden.
    const proxyTls = localPeer && external && req.headers.host === external.host && req.get('x-forwarded-proto') === 'https';
    if (!local || password) {
      if (!local && (!password || !proxyTls)) {
        res.status(403).json({ error: 'Netzwerkzugriff benötigt DASHBOARD_PASSWORD und einen lokalen HTTPS-Proxy mit DASHBOARD_ORIGIN.' });
        return;
      }
      const key = req.socket.remoteAddress ?? 'unknown';
      const now = Date.now();
      for (const [ip, entry] of failures) if (entry.until <= now) failures.delete(ip);
      const failure = failures.get(key);
      if (failure && failure.count >= 10) {
        res.set('Retry-After', String(Math.ceil((failure.until - now) / 1000))).status(429).json({ error: 'Zu viele Anmeldeversuche.' });
        return;
      }
      const authorization = req.get('authorization') ?? '';
      const decoded = /^Basic [A-Za-z0-9+/]+=*$/i.test(authorization)
        ? Buffer.from(authorization.slice(6), 'base64').toString('utf8') : '';
      const colon = decoded.indexOf(':');
      const valid = decoded.slice(0, colon) === 'cindralux' && timingSafeEqual(passwordHash, createHash('sha256').update(decoded.slice(colon + 1)).digest());
      if (!valid) {
        // Der erste Browser-Aufruf ohne Zugangsdaten ist kein Fehlversuch.
        if (authorization) {
          if (!failure && failures.size >= 1024) { res.status(429).end(); return; }
          failures.set(key, { count: (failure?.count ?? 0) + 1, until: failure?.until ?? now + 60_000 });
        }
        res.set('WWW-Authenticate', 'Basic realm="Cindralux", charset="UTF-8"').status(401).json({ error: 'Anmeldung erforderlich.' });
        return;
      }
      failures.delete(key);
    }
    res.locals.deviceLocal = local;
    res.locals.requestOrigin = proxyTls ? external!.origin : `http://${req.headers.host}`;
    next();
  };
}

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  });
  next();
};

export const apiRequestGuard: RequestHandler = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  // OAuth ist eine Navigation; der einmalige state-Wert wird in der Route geprüft.
  if (req.method === 'GET' && req.path === '/google/callback') { next(); return; }
  const origin = req.get('origin');
  const site = req.get('sec-fetch-site');
  if ((origin && origin !== res.locals.requestOrigin) || (site && site !== 'same-origin' && site !== 'none')) {
    res.status(403).json({ error: 'Fremder Ursprung nicht erlaubt.' });
    return;
  }
  const passiveRead = (req.method === 'GET' || req.method === 'HEAD') && (req.path === '/health' || req.path.startsWith('/photos/file/'));
  if (!passiveRead && req.get('x-cindralux-request') !== '1') {
    res.status(403).json({ error: 'Dashboard-Anfrage erforderlich.' });
    return;
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.is('application/json')) {
    res.status(415).json({ error: 'application/json erforderlich.' });
    return;
  }
  next();
};

/** Begrenzter Speicher und ein Budget pro Minute, ohne Vertrauen in Proxy-IP-Header. */
export function rateLimit(limit: number, applies: (req: Request) => boolean = () => true): RequestHandler {
  const clients = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    if (!applies(req)) { next(); return; }
    const now = Date.now();
    for (const [ip, bucket] of clients) if (bucket.until <= now) clients.delete(ip);
    const key = req.socket.remoteAddress ?? 'unknown';
    let bucket = clients.get(key);
    if (!bucket) {
      if (clients.size >= 1024) { res.status(429).end(); return; }
      bucket = { count: 0, until: now + 60_000 };
      clients.set(key, bucket);
    }
    if (++bucket.count > limit) {
      res.set('Retry-After', String(Math.ceil((bucket.until - now) / 1000))).status(429).json({ error: 'Zu viele Anfragen. Bitte kurz warten.' });
      return;
    }
    next();
  };
}

/** Auch freie HA-serviceData dürfen keine Prototyp-Schlüssel oder extreme Tiefe tragen. */
export function assertSafeJson(value: unknown, depth = 0): void {
  if (depth > 20) throw new Error('JSON ist zu tief verschachtelt.');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Nicht erlaubter JSON-Schlüssel.');
    assertSafeJson(child, depth + 1);
  }
}
