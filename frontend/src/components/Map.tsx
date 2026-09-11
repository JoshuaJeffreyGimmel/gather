import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Activity } from '../types';

/**
 * Leaflet on OpenStreetMap tiles — the same combination the design board was
 * rendered with. Pins are `divIcon`s so they inherit the app's own styling and
 * no marker image assets are needed.
 *
 * Before someone joins, the API hands back a pin snapped to a ~250 m grid; the
 * map draws that as a soft circle instead of a point, so "nur der Kreis" is
 * literally true rather than a caption.
 */

const ZURICH: L.LatLngTuple = [47.3782, 8.5322];

// Nine activities in a 350 px box means nine labels cannot all be readable.
// Only the selected pin carries its label; the rest stay as dots. A label on
// the right-hand side of the map opens leftwards so it never runs off the edge.
function pinIcon(label: string, active: boolean, flip: boolean) {
  const html = active
    ? `<div class="pin${flip ? ' pin--flip' : ''}" data-active="true"><span class="pin__dot"></span>${escapeHtml(label)}</div>`
    : '<div class="pin pin--dot"><span class="pin__dot"></span></div>';
  return L.divIcon({ className: '', html, iconSize: [0, 0], iconAnchor: [0, 0] });
}

function dropIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="map-drop"><span>G</span></div>',
    iconSize: [44, 44],
    iconAnchor: [14, 36]
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** The Discover map: every activity as a tappable pin. */
export function ActivityMap({
  activities,
  selectedId,
  onSelect
}: {
  activities: Activity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!host.current || map.current) return;
    const m = L.map(host.current, {
      center: ZURICH,
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true
    });
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // The container is sized by CSS, which Leaflet cannot see on first paint.
    window.setTimeout(() => m.invalidateSize(), 0);
    return () => { m.remove(); map.current = null; layer.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();

    const centreLng = activities.length
      ? activities.reduce((sum, a) => sum + a.lng, 0) / activities.length
      : 0;

    for (const a of activities) {
      const active = a.id === selectedId;
      const clock = new Date(a.startTime).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
      const marker = L.marker([a.lat, a.lng], {
        icon: pinIcon(`${a.category} · ${clock}`, active, a.lng > centreLng),
        zIndexOffset: active ? 1000 : 0,
        keyboard: false,
        title: `${a.title} · ${clock}`
      });
      marker.on('click', () => onSelectRef.current(a.id));
      marker.addTo(group);

      // Not joined yet → the neighbourhood, not the doorstep.
      if (!a.locationRevealed) {
        L.circle([a.lat, a.lng], {
          radius: 260,
          color: '#e5372a',
          weight: 1,
          opacity: active ? 0.5 : 0.22,
          fillColor: '#e5372a',
          fillOpacity: active ? 0.12 : 0.05,
          interactive: false
        }).addTo(group);
      }
    }

    if (activities.length) {
      const bounds = L.latLngBounds(activities.map((a) => [a.lat, a.lng] as L.LatLngTuple));
      m.fitBounds(bounds, { padding: [56, 56], maxZoom: 14 });
    }
  }, [activities, selectedId]);

  return <div ref={host} className="map" role="application" aria-label="Karte mit Aktivitäten in Zürich" />;
}

/** The confirmed-meetup map: one exact point with a walking radius. */
export function MeetingPointMap({ lat, lng, precise }: { lat: number; lng: number; precise: boolean }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, {
      center: [lat, lng],
      zoom: precise ? 16 : 14,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
      attributionControl: true
    });
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(m);

    L.circle([lat, lng], {
      radius: precise ? 130 : 300,
      color: '#e5372a',
      weight: 1,
      opacity: 0.35,
      fillColor: '#e5372a',
      fillOpacity: 0.1,
      interactive: false
    }).addTo(m);
    if (precise) L.marker([lat, lng], { icon: dropIcon(), keyboard: false, interactive: false }).addTo(m);

    window.setTimeout(() => m.invalidateSize(), 0);
    return () => { m.remove(); };
  }, [lat, lng, precise]);

  return <div ref={host} className="map" aria-label="Karte des Treffpunkts" />;
}
