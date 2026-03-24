import { useEffect, useRef, useMemo } from 'react';
import type { CSSProperties } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Service = {
  id: number | string;
  name: string;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  logo?: string | null;
  distance?: number | null;
  category_names?: string[];
  is_verified?: boolean;
};

type UserLocation = {
  lat: number;
  lon: number;
} | null;

type Props = {
  services: Service[];
  colors: {
    surface?: string;
    border?: string;
    text?: string;
    textSecondary?: string;
    accent?: string;
  };
  userLocation?: UserLocation;
  selectedServiceId?: number | string | null;
  onServiceClick?: (id: number | string) => void;
  style?: CSSProperties;
  dark?: boolean;
};

/* ── Tile layers ── */
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png';
const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';

/* ── Default centre (Toronto) ── */
const DEFAULT_CENTER: L.LatLngTuple = [43.65, -79.38];
const DEFAULT_ZOOM = 11;

/* ── Custom circular marker via SVG data-URI ── */
function createCircleIcon(color: string, size = 14): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
  });
}

/* ── Escape HTML for safe injection ── */
function esc(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Build popup HTML card ── */
function buildPopupHtml(service: Service, dark: boolean): string {
  const bg = dark ? '#1e1f28' : '#ffffff';
  const text = dark ? '#E6E7F2' : '#1a1c24';
  const textMuted = dark ? 'rgba(230,231,242,0.6)' : 'rgba(26,28,36,0.55)';
  const border = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const accent = '#FFD600';
  const accentText = dark ? '#FFD600' : '#b8960a';

  const initial = (service.name || '?')[0].toUpperCase();

  const logoHtml = service.logo
    ? `<img src="${esc(service.logo)}" alt="" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0;background:${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div style="display:none;width:48px;height:48px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,${accent},#e6c200);align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#000">${initial}</div>`
    : `<div style="width:48px;height:48px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,${accent},#e6c200);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#000">${initial}</div>`;

  const addressHtml = service.address
    ? `<div style="display:flex;align-items:flex-start;gap:6px;margin-top:6px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${textMuted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span style="font-size:12px;color:${textMuted};line-height:1.4">${esc(service.address)}</span>
      </div>`
    : '';

  const phoneHtml = service.phone
    ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${textMuted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <span style="font-size:12px;color:${textMuted}">${esc(service.phone)}</span>
      </div>`
    : '';

  const distanceHtml = service.distance != null
    ? `<span style="font-size:12px;font-weight:600;color:${accentText}">${service.distance.toFixed(1)} km away</span>`
    : '';

  const directionsUrl = service.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(service.address)}`
    : service.latitude != null && service.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${service.latitude},${service.longitude}`
      : '';

  const directionsHtml = directionsUrl
    ? `<a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="font-size:12px;font-weight:600;color:${accentText};text-decoration:none;display:flex;align-items:center;gap:4px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${accentText}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        Directions
      </a>`
    : '';

  return `<div style="width:280px;background:${bg};border-radius:14px;border:1px solid ${border};font-family:Rubik,system-ui,sans-serif;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,${dark ? '0.4' : '0.12'})" data-popup-id="${service.id}">
    <div style="padding:14px 16px;display:flex;gap:12px;align-items:flex-start">
      ${logoHtml}
      <div style="min-width:0;flex:1">
        <a href="/directory/service/${service.id}" class="sv-popup-link" data-service-id="${service.id}" style="font-size:14px;font-weight:700;color:${text};text-decoration:none;display:block;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(service.name)}</a>
        ${addressHtml}
        ${phoneHtml}
      </div>
    </div>
    ${(distanceHtml || directionsHtml) ? `<div style="padding:0 16px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px">${distanceHtml}${directionsHtml}</div>` : ''}
  </div>`;
}

export default function DirectoryMap({
  services,
  colors,
  userLocation,
  selectedServiceId,
  onServiceClick,
  style,
  dark = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  const locatedServices = useMemo(
    () => services.filter((s) => s.latitude != null && s.longitude != null),
    [services],
  );

  /* ── Initialise map once ── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: false,
    });

    tileRef.current = L.tileLayer(dark ? DARK_TILES : LIGHT_TILES, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 18,
      subdomains: 'abcd',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Fix Leaflet container sizing after mount
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      markersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Switch tile layer when theme changes ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;

    tileRef.current.setUrl(dark ? DARK_TILES : LIGHT_TILES);
  }, [dark]);

  /* ── Delegated click handler for popup links (SPA nav) ── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('.sv-popup-link') as HTMLAnchorElement | null;
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        const serviceId = link.dataset.serviceId;
        if (serviceId) {
          // Use history.pushState + popstate for SPA navigation without full reload
          window.history.pushState({}, '', link.href);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }
    };

    container.addEventListener('click', handler, true);
    return () => container.removeEventListener('click', handler, true);
  }, []);

  /* ── Update markers when services / selection changes ── */
  useEffect(() => {
    const map = mapRef.current;
    const group = markersRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const accentColor = colors.accent || '#4A90D9';
    const defaultIcon = createCircleIcon(accentColor);
    const selectedIcon = createCircleIcon('#FDD30B', 18);

    locatedServices.forEach((service) => {
      const isSelected = selectedServiceId === service.id;
      const marker = L.marker([service.latitude!, service.longitude!], {
        icon: isSelected ? selectedIcon : defaultIcon,
        zIndexOffset: isSelected ? 1000 : 0,
      });

      // Simple tooltip on hover (name only)
      marker.bindTooltip(
        `<strong>${esc(service.name)}</strong>`,
        { direction: 'top', offset: [0, -8], className: 'sv-map-tooltip' },
      );

      // Rich popup on click
      marker.bindPopup(buildPopupHtml(service, dark), {
        className: 'sv-map-popup',
        maxWidth: 310,
        minWidth: 280,
        offset: [0, -6],
        closeButton: true,
        autoPan: true,
        autoPanPadding: [40, 40],
      });

      group.addLayer(marker);
    });

    // Keep map zoom/center stable; avoid auto-zooming on search/filter/selection changes.
  }, [locatedServices, selectedServiceId, colors.accent, userLocation, dark]);

  return (
    <>
      {/* Tooltip & Popup styling */}
      <style>{`
        .sv-map-tooltip {
          background: ${dark ? 'rgba(30,31,40,0.95)' : 'rgba(255,255,255,0.95)'};
          color: ${dark ? '#E6E7F2' : '#1a1c24'};
          border: 1px solid ${dark ? 'rgba(188,189,208,0.2)' : 'rgba(0,0,0,0.1)'};
          border-radius: 8px;
          padding: 8px 12px;
          font-family: Rubik, sans-serif;
          font-size: 13px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .sv-map-tooltip::before {
          border-top-color: ${dark ? 'rgba(30,31,40,0.95)' : 'rgba(255,255,255,0.95)'} !important;
        }
        .sv-map-popup .leaflet-popup-content-wrapper {
          background: transparent;
          box-shadow: none;
          border-radius: 14px;
          padding: 0;
        }
        .sv-map-popup .leaflet-popup-content {
          margin: 0;
          width: auto !important;
        }
        .sv-map-popup .leaflet-popup-tip-container {
          display: none;
        }
        .sv-map-popup .leaflet-popup-close-button {
          color: ${dark ? '#E6E7F2' : '#1a1c24'};
          font-size: 20px;
          font-weight: 400;
          top: 6px;
          right: 8px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        .sv-map-popup .leaflet-popup-close-button:hover {
          color: ${dark ? '#fff' : '#000'};
        }
        .sv-map-popup .sv-popup-link:hover {
          color: #FFD600 !important;
          text-decoration: underline !important;
        }
        .leaflet-control-zoom a {
          background: ${dark ? 'rgba(30,31,40,0.9)' : 'rgba(255,255,255,0.9)'} !important;
          color: ${dark ? '#E6E7F2' : '#1a1c24'} !important;
          border-color: ${dark ? 'rgba(188,189,208,0.2)' : 'rgba(0,0,0,0.1)'} !important;
        }
      `}</style>
      <div
        ref={containerRef}
        style={{
          minHeight: 420,
          width: '100%',
          background: colors.surface || 'rgba(255,255,255,0.03)',
          ...style,
        }}
      />
    </>
  );
}
