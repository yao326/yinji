import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, AttributionControl, setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { PhotoLocation } from "../data/types";

type GlobeMapProps = {
  locations: PhotoLocation[];
  covers: Record<string, string>;
  activeLocationId?: string;
  onSelectLocation: (location: PhotoLocation) => void;
  onSelectCluster?: (locations: PhotoLocation[]) => void;
};

type Cluster = {
  primary: PhotoLocation;
  members: PhotoLocation[];
  photos: PhotoLocation["photos"];
};

const mapStyle = import.meta.env.VITE_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
setWorkerUrl(maplibreWorkerUrl);

function addSatelliteBase(map: MapLibreMap) {
  if (map.getSource("satellite")) return;
  const style = map.getStyle();
  if (!style || !style.layers) return;

  map.setPaintProperty("background", "background-color", "#05070d");
  map.setPaintProperty("background", "background-opacity", 0);

  style.layers.forEach((layer: any) => {
    if (layer.type === "fill") {
      map.setPaintProperty(layer.id, "fill-opacity", 0);
    }
    if (layer.id === "natural_earth") {
      map.setPaintProperty(layer.id, "raster-opacity", 1);
    }
  });

  map.addSource("satellite", {
    type: "raster",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    bounds: [-180, -82, 180, 82],
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics"
  });

  const beforeLayer = style.layers.find(
    (layer: any) => layer.id !== "background" && layer.id !== "natural_earth"
  )?.id;

  if (beforeLayer) {
    map.addLayer({ id: "satellite-base", type: "raster", source: "satellite" }, beforeLayer);
  } else {
    map.addLayer({ id: "satellite-base", type: "raster", source: "satellite" });
  }
}

function approxDistance(a: [number, number], b: [number, number]): number {
  const midLat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dLat = a[1] - b[1];
  const dLng = (a[0] - b[0]) * Math.cos(midLat);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function mergeRadius(zoom: number): number {
  return 10 / Math.pow(2, zoom);
}

function clusterLocations(locations: PhotoLocation[], zoom: number): Cluster[] {
  const radius = mergeRadius(zoom);
  const clusters: Cluster[] = [];

  for (const loc of locations) {
    let hit: Cluster | undefined;
    for (const c of clusters) {
      if (approxDistance(c.primary.coordinates, loc.coordinates) <= radius) {
        hit = c;
        break;
      }
    }
    if (hit) {
      hit.members.push(loc);
      hit.photos.push(...loc.photos);
      const best = hit.members.reduce((a, b) => (b.photos.length > a.photos.length ? b : a));
      hit.primary = best;
    } else {
      clusters.push({ primary: loc, members: [loc], photos: [...loc.photos] });
    }
  }

  return clusters;
}

export function GlobeMap({ locations, covers, activeLocationId, onSelectLocation, onSelectCluster }: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelectLocation);
  const onSelectClusterRef = useRef(onSelectCluster);
  const coversRef = useRef(covers);
  const locationsRef = useRef(locations);
  const renderAllRef = useRef<() => void>(() => {});

  onSelectRef.current = onSelectLocation;
  onSelectClusterRef.current = onSelectCluster;
  coversRef.current = covers;
  locationsRef.current = locations;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: mapStyle,
      center: [106, 31],
      zoom: 1.35,
      minZoom: 0.8,
      maxZoom: 12,
      pitch: 18,
      attributionControl: false,
    });

    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: "Map data © OpenStreetMap contributors · Imagery © Esri"
      }),
      "bottom-left"
    );

    mapRef.current = map;
    if (import.meta.env.DEV) { (window as any).__yinjiMap = map; }

    let zoomTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRender = () => {
      if (zoomTimer) clearTimeout(zoomTimer);
      zoomTimer = setTimeout(() => renderAllRef.current(), 140);
    };
    map.on("zoom", scheduleRender);

    map.once("load", () => {
      addSatelliteBase(map);
      map.setProjection({ type: "globe" });
      renderAllRef.current();
    });

    return () => {
      if (zoomTimer) clearTimeout(zoomTimer);
      map.off("zoom", scheduleRender);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  renderAllRef.current = () => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const zoom = map.getZoom();
    const clusters = clusterLocations(locationsRef.current, zoom);

    clusters.forEach((cluster) => {
      const primary = cluster.primary;
      const coverId = coversRef.current[primary.id] || primary.coverPhotoId;
      const orderedPhotos = [
        cluster.photos.find((photo) => photo.id === coverId) || cluster.photos[0],
        ...cluster.photos.filter((photo) => photo.id !== coverId)
      ].slice(0, 3);

      const isCluster = cluster.members.length > 1;
      const labelText = isCluster ? cluster.members.length + " 个地点" : primary.name;

      const element = document.createElement("div");
      element.className = "photo-stack-marker";
      element.setAttribute("aria-label", labelText + "，" + cluster.photos.length + " 张照片");

      const button = document.createElement("button");
      button.className = "photo-stack";
      button.type = "button";

      orderedPhotos
        .slice()
        .reverse()
        .forEach((photo, reversedIndex) => {
          const stackIndex = orderedPhotos.length - 1 - reversedIndex;
          const card = document.createElement("span");
          card.className = "photo-card";
          card.style.setProperty("--stack-index", String(stackIndex));
          card.innerHTML = '<img src="' + photo.thumb + '" alt="" />';
          button.appendChild(card);
        });

      const count = document.createElement("span");
      count.className = "photo-count";
      count.textContent = String(cluster.photos.length);
      button.appendChild(count);

      const label = document.createElement("span");
      label.className = "place-label";
      label.textContent = labelText;

      element.append(button, label);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (isCluster) {
          map.flyTo({
            center: primary.coordinates,
            zoom: Math.min(map.getZoom() + 2, 11),
            duration: 650,
            essential: true
          });
          onSelectClusterRef.current?.(cluster.members);
        } else {
          onSelectRef.current(primary);
        }
      });

      const marker = new Marker({ element, anchor: "bottom" })
        .setLngLat(primary.coordinates)
        .addTo(map);
      marker.setOpacity(1, 0);
      markersRef.current.push(marker);
    });
  };

  useEffect(() => {
    if (!mapRef.current) return;
    renderAllRef.current();
  }, [locations, covers]);

  useEffect(() => {
    if (!activeLocationId || !mapRef.current) return;
    const location = locations.find((item) => item.id === activeLocationId);
    if (!location) return;

    mapRef.current.flyTo({
      center: location.coordinates,
      zoom: 12,
      pitch: 0,
      duration: 700,
      essential: true
    });
  }, [activeLocationId, locations]);

  return <div ref={containerRef} className="globe-map" />;
}