/**
 * Proxy geolocation matching.
 *
 * GoLogin's most valuable idea (and the single most common failure in the
 * independent Pixelscan / Iphey tests of AdsPower and Dolphin Anty) is that the
 * timezone, locale and WebRTC public IP must follow the proxy's exit country.
 * A US proxy with Asia/Dhaka timezone is an instant contradiction.
 */
import type { FingerprintSpec } from './profile';

export interface GeoProfile {
  country: string;
  name: string;
  timezone: string;
  offset: number;
  locale: string;
  languages: string[];
}

export const GEO: Record<string, GeoProfile> = {
  US: { country: 'US', name: 'United States', timezone: 'America/New_York', offset: 240, locale: 'en-US', languages: ['en-US', 'en'] },
  CA: { country: 'CA', name: 'Canada', timezone: 'America/Toronto', offset: 240, locale: 'en-CA', languages: ['en-CA', 'en-US', 'en'] },
  GB: { country: 'GB', name: 'United Kingdom', timezone: 'Europe/London', offset: 0, locale: 'en-GB', languages: ['en-GB', 'en'] },
  IE: { country: 'IE', name: 'Ireland', timezone: 'Europe/Dublin', offset: 0, locale: 'en-IE', languages: ['en-IE', 'en-GB', 'en'] },
  DE: { country: 'DE', name: 'Germany', timezone: 'Europe/Berlin', offset: -60, locale: 'de-DE', languages: ['de-DE', 'de', 'en-US', 'en'] },
  FR: { country: 'FR', name: 'France', timezone: 'Europe/Paris', offset: -60, locale: 'fr-FR', languages: ['fr-FR', 'fr', 'en-US', 'en'] },
  NL: { country: 'NL', name: 'Netherlands', timezone: 'Europe/Amsterdam', offset: -60, locale: 'nl-NL', languages: ['nl-NL', 'nl', 'en-US', 'en'] },
  ES: { country: 'ES', name: 'Spain', timezone: 'Europe/Madrid', offset: -120, locale: 'es-ES', languages: ['es-ES', 'es', 'en-US', 'en'] },
  IT: { country: 'IT', name: 'Italy', timezone: 'Europe/Rome', offset: -120, locale: 'it-IT', languages: ['it-IT', 'it', 'en-US', 'en'] },
  PL: { country: 'PL', name: 'Poland', timezone: 'Europe/Warsaw', offset: -120, locale: 'pl-PL', languages: ['pl-PL', 'pl', 'en-US', 'en'] },
  SE: { country: 'SE', name: 'Sweden', timezone: 'Europe/Stockholm', offset: -120, locale: 'sv-SE', languages: ['sv-SE', 'sv', 'en-US', 'en'] },
  CH: { country: 'CH', name: 'Switzerland', timezone: 'Europe/Zurich', offset: -120, locale: 'de-CH', languages: ['de-CH', 'de', 'en-US', 'en'] },
  TR: { country: 'TR', name: 'Türkiye', timezone: 'Europe/Istanbul', offset: -180, locale: 'tr-TR', languages: ['tr-TR', 'tr', 'en-US', 'en'] },
  UA: { country: 'UA', name: 'Ukraine', timezone: 'Europe/Kyiv', offset: -180, locale: 'uk-UA', languages: ['uk-UA', 'uk', 'en-US', 'en'] },
  AE: { country: 'AE', name: 'United Arab Emirates', timezone: 'Asia/Dubai', offset: -240, locale: 'ar-AE', languages: ['ar-AE', 'ar', 'en-US', 'en'] },
  IN: { country: 'IN', name: 'India', timezone: 'Asia/Kolkata', offset: -330, locale: 'en-IN', languages: ['en-IN', 'hi-IN', 'en-US', 'en'] },
  BD: { country: 'BD', name: 'Bangladesh', timezone: 'Asia/Dhaka', offset: -360, locale: 'bn-BD', languages: ['bn-BD', 'en-US', 'en'] },
  SG: { country: 'SG', name: 'Singapore', timezone: 'Asia/Singapore', offset: -480, locale: 'en-SG', languages: ['en-SG', 'zh-SG', 'en-US', 'en'] },
  TH: { country: 'TH', name: 'Thailand', timezone: 'Asia/Bangkok', offset: -420, locale: 'th-TH', languages: ['th-TH', 'th', 'en-US', 'en'] },
  ID: { country: 'ID', name: 'Indonesia', timezone: 'Asia/Jakarta', offset: -420, locale: 'id-ID', languages: ['id-ID', 'id', 'en-US', 'en'] },
  VN: { country: 'VN', name: 'Vietnam', timezone: 'Asia/Ho_Chi_Minh', offset: -420, locale: 'vi-VN', languages: ['vi-VN', 'vi', 'en-US', 'en'] },
  PH: { country: 'PH', name: 'Philippines', timezone: 'Asia/Manila', offset: -480, locale: 'en-PH', languages: ['en-PH', 'en-US', 'en'] },
  HK: { country: 'HK', name: 'Hong Kong', timezone: 'Asia/Hong_Kong', offset: -480, locale: 'zh-HK', languages: ['zh-HK', 'en-US', 'en'] },
  JP: { country: 'JP', name: 'Japan', timezone: 'Asia/Tokyo', offset: -540, locale: 'ja-JP', languages: ['ja-JP', 'ja', 'en-US', 'en'] },
  KR: { country: 'KR', name: 'South Korea', timezone: 'Asia/Seoul', offset: -540, locale: 'ko-KR', languages: ['ko-KR', 'ko', 'en-US', 'en'] },
  AU: { country: 'AU', name: 'Australia', timezone: 'Australia/Sydney', offset: -600, locale: 'en-AU', languages: ['en-AU', 'en-GB', 'en'] },
  NZ: { country: 'NZ', name: 'New Zealand', timezone: 'Pacific/Auckland', offset: -720, locale: 'en-NZ', languages: ['en-NZ', 'en-GB', 'en'] },
  BR: { country: 'BR', name: 'Brazil', timezone: 'America/Sao_Paulo', offset: 180, locale: 'pt-BR', languages: ['pt-BR', 'pt', 'en-US', 'en'] },
  MX: { country: 'MX', name: 'Mexico', timezone: 'America/Mexico_City', offset: 360, locale: 'es-MX', languages: ['es-MX', 'es', 'en-US', 'en'] },
  ZA: { country: 'ZA', name: 'South Africa', timezone: 'Africa/Johannesburg', offset: -120, locale: 'en-ZA', languages: ['en-ZA', 'en-GB', 'en'] },
};

export const GEO_COUNTRIES = Object.keys(GEO);

export function geoForCountry(country: string): GeoProfile | null {
  return GEO[(country ?? '').trim().toUpperCase()] ?? null;
}

/** Align a fingerprint to the proxy exit country. Returns a new spec. */
export function applyGeoToSpec(spec: FingerprintSpec, country: string): FingerprintSpec {
  const g = geoForCountry(country);
  if (!g) return spec;
  return {
    ...spec,
    timezone: g.timezone,
    timezoneOffset: offsetForZone(g.timezone),
    locale: g.locale,
    languages: g.languages,
    webrtcMode: 'replace',
  };
}

/**
 * JavaScript `Date.getTimezoneOffset()` for an IANA zone at the current date.
 *
 * The sign is inverted from the familiar UTC offset: New York in November is
 * `300`, Dhaka is `-360`. We ask Intl for the zone's long/short GMT offset so
 * daylight saving rules stay correct instead of shipping a frozen number.
 * Older WebView runtimes without `shortOffset` fall back to the curated table.
 */
export function offsetForZone(zone: string, at: Date = new Date()): number {
  try {
    for (const style of ['shortOffset', 'longOffset']) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        timeZoneName: style as Intl.DateTimeFormatOptions['timeZoneName'],
      }).formatToParts(at);
      const label = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
      const match = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(label);
      if (match) {
        const sign = match[1];
        const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
        return sign === '+' ? -minutes : minutes;
      }
    }
  } catch {
    // Intl zone data unavailable: use the curated fallback below.
  }
  const hit = Object.values(GEO).find((g) => g.timezone === zone);
  return hit?.offset ?? 0;
}
