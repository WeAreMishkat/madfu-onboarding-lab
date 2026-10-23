/**
 * Configurable URL validation for Stage 1. A format check does NOT prove that the applicant owns the
 * website or the location; ownership is out of scope of these checks.
 */
export const URL_RULES = {
  /** Hosts that are not accepted as the merchant's own website. */
  socialHosts: ['instagram.com', 'facebook.com', 'fb.com', 'tiktok.com', 'x.com', 'twitter.com', 'snapchat.com', 'linkedin.com', 'youtube.com', 'linktr.ee', 't.me', 'telegram.me'],
  whatsappHosts: ['wa.me', 'whatsapp.com', 'api.whatsapp.com', 'chat.whatsapp.com', 'wa.link'],
  /** Accepted location links. Path prefixes apply to the google.com hosts. */
  mapsHosts: ['maps.google.com', 'maps.app.goo.gl', 'goo.gl', 'g.page'],
  mapsGooglePaths: ['/maps']
};

export type UrlError = 'empty' | 'format' | 'social' | 'whatsapp' | 'not-maps';

export const URL_ERROR_COPY: Record<UrlError, string> = {
  empty: 'Enter a link.',
  format: 'Enter a full link, for example https://yourstore.com.',
  social: 'Enter your own website, not a social-media page.',
  whatsapp: 'A WhatsApp link cannot be used as your website.',
  'not-maps': 'Enter a Google Maps link to your location.'
};

function parse(v: string): URL | null {
  const t = v.trim();
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    // A real host: at least one dot and a 2+ letter top-level domain, no spaces.
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

const hostIs = (host: string, list: string[]) => {
  const h = host.toLowerCase().replace(/^www\./, '');
  return list.some((d) => h === d || h.endsWith(`.${d}`));
};

export function validateWebsite(v: string): UrlError | null {
  if (!v.trim()) return 'empty';
  const u = parse(v);
  if (!u) return 'format';
  if (hostIs(u.hostname, URL_RULES.whatsappHosts)) return 'whatsapp';
  if (hostIs(u.hostname, URL_RULES.socialHosts)) return 'social';
  return null;
}

export function validateMapsUrl(v: string): UrlError | null {
  if (!v.trim()) return 'empty';
  const u = parse(v);
  if (!u) return 'format';
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (hostIs(host, URL_RULES.mapsHosts)) return null;
  if ((host === 'google.com' || /^google\.[a-z.]+$/.test(host)) && URL_RULES.mapsGooglePaths.some((p) => u.pathname.startsWith(p))) return null;
  return 'not-maps';
}
