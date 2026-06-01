import React, { memo, useMemo } from 'react';
import Building2 from 'lucide-react/dist/esm/icons/building-2';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Navigation from 'lucide-react/dist/esm/icons/navigation';
import Phone from 'lucide-react/dist/esm/icons/phone';
import { extractServicePayload, pickServiceItems } from '~/utils/streetbotService';

type ServiceItem = Record<string, unknown>;

const asRecord = (value: unknown): ServiceItem => {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ServiceItem) : {};
};

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
};

const firstNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const firstStringList = (...values: unknown[]): string[] => {
  for (const value of values) {
    if (!Array.isArray(value)) {
      continue;
    }
    const strings = value
      .map((entry) => firstString(entry))
      .filter(Boolean)
      .slice(0, 4);
    if (strings.length) {
      return strings;
    }
  }
  return [];
};

const normalizeUrl = (url: string): string => {
  if (!url) {
    return '';
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `https://${url}`;
};

const formatDistance = (km: number | null): string => {
  if (km == null) {
    return '';
  }
  if (km < 1) {
    return `${Math.max(1, Math.round(km * 1000))} m away`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km away`;
  }
  return `${Math.round(km)} km away`;
};

const getAddress = (service: ServiceItem): string => {
  return firstString(
    service.address,
    service.full_address,
    service.formatted_address,
    service.location,
    [service.street, service.city, service.province].filter(Boolean).join(', '),
    service.city,
  );
};

const getServiceId = (service: ServiceItem): string => {
  return firstString(service.id, service.service_id, service.slug);
};

const getDirectionsUrl = (service: ServiceItem, address: string): string => {
  const lat = firstNumber(service.latitude, service.lat);
  const lon = firstNumber(service.longitude, service.lon, service.lng);
  const destination = lat != null && lon != null ? `${lat},${lon}` : address;
  return destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
    : '';
};

const StreetBotServiceResults = memo(({ raw }: { raw: string }) => {
  const services = useMemo(() => {
    const payload = extractServicePayload(raw);
    return pickServiceItems(payload)
      .map(asRecord)
      .filter((item) => firstString(item.name));
  }, [raw]);

  if (!services.length) {
    return (
      <div className="not-prose my-4 rounded-2xl border border-white/10 bg-black/35 p-4 font-sans text-sm text-white/75 shadow-xl shadow-black/20 backdrop-blur-xl">
        I could not find a strong service match yet.
      </div>
    );
  }

  return (
    <div
      className="not-prose my-4 grid gap-3 font-sans sm:grid-cols-2"
      style={{ whiteSpace: 'normal' }}
      data-testid="streetbot-service-results"
    >
      {services.slice(0, 6).map((service, index) => {
        const id = getServiceId(service);
        const name = firstString(service.name);
        const overview = firstString(service.overview, service.description, service.summary);
        const address = getAddress(service);
        const phone = firstString(service.phone, service.phone_number, service.telephone);
        const website = normalizeUrl(firstString(service.website, service.url));
        const categories = firstStringList(
          service.category_names,
          service.categories,
          service.service_types,
          service.tags,
        );
        const distance = formatDistance(
          firstNumber(
            service.distance,
            service.distance_km,
            service.geo_distance_km,
            service._geo_distance_km,
          ),
        );
        const directionsUrl = getDirectionsUrl(service, address);
        const detailHref = id ? `/directory/service/${encodeURIComponent(id)}` : '/directory';

        return (
          <article
            key={`${id || name}-${index}`}
            className="rounded-2xl border border-white/10 bg-[#11141b]/90 p-4 text-white shadow-xl shadow-black/25 backdrop-blur-xl"
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-yellow-300/25 bg-yellow-300/15 text-yellow-300">
                <Building2 size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="m-0 text-base font-bold leading-tight text-white">{name}</h3>
                {categories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {categories.slice(0, 3).map((category) => (
                      <span
                        key={category}
                        className="rounded-full border border-yellow-300/25 bg-yellow-300/10 px-2 py-0.5 text-xs font-semibold text-yellow-200"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {overview && (
              <p className="mb-3 line-clamp-2 text-sm leading-6 text-white/75">{overview}</p>
            )}

            <div className="mb-4 space-y-2 rounded-xl bg-white/[0.04] p-3 text-sm text-white/80">
              {address && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 shrink-0 text-yellow-300" size={16} />
                  <span>{address}</span>
                </div>
              )}
              {distance && (
                <div className="flex items-center gap-2 font-semibold text-emerald-400">
                  <Navigation size={16} />
                  <span>{distance}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {phone && (
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/15 px-3 py-2 text-sm font-semibold text-emerald-300 no-underline hover:bg-emerald-400/20"
                >
                  <Phone size={15} />
                  Call
                </a>
              )}
              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-400/15 px-3 py-2 text-sm font-semibold text-blue-300 no-underline hover:bg-blue-400/20"
                >
                  <Navigation size={15} />
                  Directions
                </a>
              )}
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-400/15 px-3 py-2 text-sm font-semibold text-blue-300 no-underline hover:bg-blue-400/20"
                >
                  <ExternalLink size={15} />
                  Website
                </a>
              )}
              <a
                href={detailHref}
                className="inline-flex items-center rounded-lg bg-yellow-300/15 px-3 py-2 text-sm font-semibold text-yellow-200 no-underline hover:bg-yellow-300/20"
              >
                View Details
              </a>
            </div>
          </article>
        );
      })}
    </div>
  );
});

StreetBotServiceResults.displayName = 'StreetBotServiceResults';

export default StreetBotServiceResults;
