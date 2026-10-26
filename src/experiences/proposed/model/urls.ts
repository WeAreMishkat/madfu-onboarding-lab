/**
 * Configurable store-presence validation (Business Details). Purpose: fraud / store-presence evidence
 * for the channel declared on Page 1. A Google Maps link is the actual selling branch or store; it is
 * NOT the National Address (legal / HQ data retrieved with the CR). A format check does not prove
 * ownership of the website or the location.
 */
export const URL_RULES = {
  /** Hosts not accepted as the merchant's own online store (policy: official store presence). */
  socialHosts: ['instagram.com', 'facebook.com', 'fb.com', 'tiktok.com', 'x.com', 'twitter.com', 'snapchat.com', 'linkedin.com', 'youtube.com', 'linktr.ee', 't.me', 'telegram.me'],
  whatsappHosts: ['wa.me', 'whatsapp.com', 'api.whatsapp.com', 'chat.whatsapp.com', 'wa.link'],
  /** Link shorteners hide the destination: ask for the full store link. */
  shortenerHosts: ['bit.ly', 'tinyurl.com', 'cutt.ly', 'rebrand.ly', 'ow.ly'],
  /** Google Maps hosts accepted as they are. */
  mapsHosts: ['maps.app.goo.gl', 'g.page', 'g.co'],
  /** Google hosts (any country domain, e.g. google.com.sa) accepted with a /maps path or a maps.* subdomain. */
  googleMapsPath: '/maps',
  /** goo.gl is accepted only for its /maps short links. */
  googShortMapsPath: '/maps'
};

export type UrlError = 'empty' | 'format' | 'social' | 'whatsapp' | 'shortener' | 'not-maps';

export const URL_ERROR_COPY: Record<UrlError, string> = {
  empty: 'Enter a link.',
  format: 'Enter a valid link, for example yourstore.com.',
  social: 'Enter your own online store, not a social-media page.',
  whatsapp: 'A WhatsApp link cannot be used as your online store.',
  shortener: 'Enter the full link to your store, not a shortened link.',
  'not-maps': 'Enter a Google Maps link to your store or branch.'
};

/** Adds https:// when the scheme is missing; trims spaces. */
export function normaliseUrl(v: string): string {
  const t = v.trim();
  if (!t) return t;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
}

function parse(v: string): URL | null {
  const t = normaliseUrl(v);
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    // A real host: at least one dot and a top-level domain (Latin, or an internationalised xn-- label).
    if (!/^([a-z0-9-]+\.)+([a-z]{2,}|xn--[a-z0-9-]+)$/i.test(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

const bare = (host: string) => host.toLowerCase().replace(/^www\./, '');
const hostIs = (host: string, list: string[]) => {
  const h = bare(host);
  return list.some((d) => h === d || h.endsWith(`.${d}`));
};
/** google.com, google.com.sa, google.ae … */
const isGoogle = (host: string) => /^google\.[a-z.]+$/.test(bare(host));

export function validateWebsite(v: string): UrlError | null {
  if (!v.trim()) return 'empty';
  const u = parse(v);
  if (!u) return 'format';
  if (hostIs(u.hostname, URL_RULES.whatsappHosts)) return 'whatsapp';
  if (hostIs(u.hostname, URL_RULES.socialHosts)) return 'social';
  if (hostIs(u.hostname, URL_RULES.shortenerHosts)) return 'shortener';
  return null;
}

export function validateMapsUrl(v: string): UrlError | null {
  if (!v.trim()) return 'empty';
  const u = parse(v);
  if (!u) return 'format';
  const host = bare(u.hostname);
  if (hostIs(host, URL_RULES.mapsHosts)) return null;
  if (host === 'goo.gl' && u.pathname.startsWith(URL_RULES.googShortMapsPath)) return null;
  if (host.startsWith('maps.') && isGoogle(host.slice(5))) return null;
  if (isGoogle(host) && u.pathname.startsWith(URL_RULES.googleMapsPath)) return null;
  return 'not-maps';
}
