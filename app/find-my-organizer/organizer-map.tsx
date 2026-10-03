"use client";

import "leaflet/dist/leaflet.css";

import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";

import type { MappedPerson } from "@/lib/queries/organizer-locations";

// Standard OpenStreetMap tiles: free for light, attributed use.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
// North Campus, where the event is, until someone is sharing.
const DEFAULT_VIEW: Leaflet.LatLngTuple = [42.2929, -83.7165];
const CLOSE_ZOOM = 18;
const SURFACE = "#ffffff";

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );
}

function markerIcon(
  L: typeof Leaflet,
  name: string,
  color: string,
  selected: boolean,
) {
  // The white ring keeps the dot readable over the trail and the basemap, and
  // the always-visible name means color never identifies anyone alone.
  const size = selected ? 18 : 14;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="position:relative;width:${size}px;height:${size}px">
        <span style="position:absolute;inset:0;border-radius:999px;background:${color};box-shadow:0 0 0 2px ${SURFACE}${selected ? `,0 0 0 4px ${color}` : ""}"></span>
        <span style="position:absolute;left:${size + 6}px;top:50%;transform:translateY(-50%);white-space:nowrap;padding:1px 6px;border-radius:2px;font:600 12px/18px var(--font-red-hat-display),system-ui,sans-serif;background:${SURFACE};color:#17171a;box-shadow:0 1px 2px rgba(0,0,0,.18)">${escapeHtml(name)}</span>
      </div>`,
  });
}

export function OrganizerMap({
  people,
  colors,
  selectedId,
  onSelect,
}: {
  people: MappedPerson[];
  colors: Map<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layersRef = useRef<Leaflet.LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // Leaflet touches `window` on import, so it loads only in the browser.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current).setView(DEFAULT_VIEW, 16);
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(
        map,
      );
      leafletRef.current = L;
      mapRef.current = map;
      layersRef.current = L.layerGroup().addTo(map);
      setReady(true);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!ready || !L || !map || !layers) return;

    layers.clearLayers();
    // The selected person is drawn last so their trail and label sit on top.
    const ordered = [...people].sort(
      (a, b) => Number(a.id === selectedId) - Number(b.id === selectedId),
    );

    for (const person of ordered) {
      const color = colors.get(person.id) ?? "#8a8a84";
      const selected = person.id === selectedId;
      const dimmed = selectedId !== null && !selected;
      const position: Leaflet.LatLngTuple = [person.latitude, person.longitude];

      if (person.accuracy) {
        L.circle(position, {
          radius: person.accuracy,
          color,
          weight: 1,
          opacity: dimmed ? 0.25 : 0.6,
          fillColor: color,
          fillOpacity: dimmed ? 0.03 : 0.08,
          interactive: false,
        }).addTo(layers);
      }

      if (person.trail.length > 1) {
        L.polyline(
          person.trail.map((point) => [point.latitude, point.longitude]),
          { color, weight: 2, opacity: dimmed ? 0.25 : 0.85 },
        ).addTo(layers);
      }

      // Earlier fixes along the trail, each hoverable for its time. The newest
      // is the main marker, so it is skipped here.
      for (const point of person.trail.slice(0, -1)) {
        L.circleMarker([point.latitude, point.longitude], {
          radius: 4,
          color: SURFACE,
          weight: 2,
          fillColor: color,
          fillOpacity: dimmed ? 0.3 : 1,
          opacity: dimmed ? 0.3 : 1,
        })
          .bindTooltip(
            `${escapeHtml(person.name)} · ${timeFormat.format(new Date(point.recordedAt))}`,
            { direction: "top", offset: [0, -4] },
          )
          .on("click", () => onSelect(person.id))
          .addTo(layers);
      }

      L.marker(position, {
        icon: markerIcon(L, person.name, color, selected),
        opacity: dimmed ? 0.55 : 1,
        zIndexOffset: selected ? 1000 : 0,
        keyboard: true,
        title: person.name,
      })
        .on("click", () => onSelect(person.id))
        .addTo(layers);
    }

    // Frame everyone once. After that, refreshes leave the viewport alone so
    // someone who has zoomed in isn't yanked back out every 30 seconds.
    if (!fittedRef.current && people.length > 0) {
      fittedRef.current = true;
      map.fitBounds(
        L.latLngBounds(
          people.map((person) => [person.latitude, person.longitude]),
        ),
        { padding: [48, 48], maxZoom: CLOSE_ZOOM },
      );
    }
  }, [people, colors, selectedId, onSelect, ready]);

  // Moves only when the selection changes, not when a refresh moves someone.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedId) return;
    const person = people.find((candidate) => candidate.id === selectedId);
    if (!person) return;
    map.flyTo(
      [person.latitude, person.longitude],
      Math.max(map.getZoom(), 17),
      {
        duration: 0.6,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Map of organizer locations"
      // `isolate` keeps Leaflet's high z-index panes under dialogs and sheets.
      className="isolate h-[380px] w-full overflow-hidden border border-ui-line bg-ui-well lg:h-[560px]"
    />
  );
}
