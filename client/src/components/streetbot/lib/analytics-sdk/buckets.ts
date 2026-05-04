// Privacy-preserving bucketing helpers. Continuous values that could
// fingerprint a user are bucketed before send. See PRIVACY.md.

export function lengthBucket(n: number): '0' | '1-50' | '51-280' | '281-1000' | '1001+' {
  if (n <= 0) return '0';
  if (n <= 50) return '1-50';
  if (n <= 280) return '51-280';
  if (n <= 1000) return '281-1000';
  return '1001+';
}

export function fileSizeBucket(bytes: number): '<100kb' | '100kb-1mb' | '1-10mb' | '10-100mb' | '>100mb' {
  const kb = bytes / 1024;
  if (kb < 100) return '<100kb';
  if (kb < 1024) return '100kb-1mb';
  if (kb < 10 * 1024) return '1-10mb';
  if (kb < 100 * 1024) return '10-100mb';
  return '>100mb';
}

export function durationBucket(ms: number): '<5s' | '5-30s' | '30s-2m' | '2-10m' | '10-30m' | '>30m' {
  const s = ms / 1000;
  if (s < 5) return '<5s';
  if (s < 30) return '5-30s';
  if (s < 120) return '30s-2m';
  if (s < 600) return '2-10m';
  if (s < 1800) return '10-30m';
  return '>30m';
}

export function timeToReplyBucket(ms: number): '<1m' | '1-15m' | '15m-1h' | '1-24h' | '>24h' {
  const m = ms / 1000 / 60;
  if (m < 1) return '<1m';
  if (m < 15) return '1-15m';
  if (m < 60) return '15m-1h';
  if (m < 24 * 60) return '1-24h';
  return '>24h';
}

export function timeToCompleteBucket(ms: number): '<5m' | '5-30m' | '30m-2h' | '2-24h' | '>24h' {
  const m = ms / 1000 / 60;
  if (m < 5) return '<5m';
  if (m < 30) return '5-30m';
  if (m < 120) return '30m-2h';
  if (m < 24 * 60) return '2-24h';
  return '>24h';
}

export function radiusBucket(km: number): '<1km' | '1-5km' | '5-25km' | '>25km' {
  if (km < 1) return '<1km';
  if (km < 5) return '1-5km';
  if (km < 25) return '5-25km';
  return '>25km';
}

export function priceBucket(amount: number): '<$50' | '$50-200' | '$200-1000' | '$1000-5000' | '>$5000' {
  if (amount < 50) return '<$50';
  if (amount < 200) return '$50-200';
  if (amount < 1000) return '$200-1000';
  if (amount < 5000) return '$1000-5000';
  return '>$5000';
}

export function unreadCountBucket(n: number): '0' | '1-5' | '6-20' | '21-100' | '100+' {
  if (n === 0) return '0';
  if (n <= 5) return '1-5';
  if (n <= 20) return '6-20';
  if (n <= 100) return '21-100';
  return '100+';
}

export function clampResultCount(n: number): number | '100+' {
  return n <= 100 ? n : '100+';
}

export function viewportBucket(width: number): 'sm' | 'md' | 'lg' | 'xl' {
  if (width < 640) return 'sm';
  if (width < 1024) return 'md';
  if (width < 1440) return 'lg';
  return 'xl';
}

export function scoreBucket(percent: number): '<50' | '50-69' | '70-84' | '85-100' {
  if (percent < 50) return '<50';
  if (percent < 70) return '50-69';
  if (percent < 85) return '70-84';
  return '85-100';
}

export function completenessBucket(percent: number): '<25' | '25-49' | '50-74' | '75-99' | '100' {
  if (percent < 25) return '<25';
  if (percent < 50) return '25-49';
  if (percent < 75) return '50-74';
  if (percent < 100) return '75-99';
  return '100';
}

export function rowCountBucket(n: number): '<10' | '10-100' | '100-1k' | '1k-10k' | '10k+' {
  if (n < 10) return '<10';
  if (n < 100) return '10-100';
  if (n < 1000) return '100-1k';
  if (n < 10000) return '1k-10k';
  return '10k+';
}

export function deviceTypeFromUserAgent(ua: string): 'desktop' | 'tablet' | 'mobile' {
  const u = ua.toLowerCase();
  if (/(ipad|tablet)/.test(u)) return 'tablet';
  if (/(mobile|iphone|android)/.test(u)) return 'mobile';
  return 'desktop';
}
