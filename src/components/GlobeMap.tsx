import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, AttributionControl, setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { PhotoLocation } from "../data/types";

type GlobeMapProps = {
  locations: PhotoLocation[];
  covers: Record<string, string>;
  activeLocationId?: string;
  onSelectLocation: (location: PhotoLocation) => void;
};

const mapStyle = import.meta.env.VITE_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
setWorkerUrl(maplibreWorkerUrl);

function addSatelliteBase(map: MapLibreMap) {
  if (map.getSource("satellite")) return;
  const style = map.getStyle();
  if (!style || !style.layers) return;

  map.setPaintProperty("background", "background-color", "#05070d");
  map.setPaintProperty("background", "background-opacity", 0);

  // 隐藏矢量填充，保留道路/地名和南北极的自然地球底图（避免极点黑圈）
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

export function GlobeMap({ locations, covers, activeLocationId, onSelectLocation }: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelectLocation);
  const coversRef = useRef(covers);
  const locationsRef = useRef(locations);
  const renderAllRef = useRef<() => void>(() => {});

  onSelectRef.current = onSelectLocation;
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

    map.once("load", () => {
      addSatelliteBase(map);
      map.setProjection({ type: "globe" });
      renderAllRef.current();
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 每次渲染更新 renderAll 的最新实现
  renderAllRef.current = () => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    locationsRef.current.forEach((location) => {
      const coverId = coversRef.current[location.id] || location.coverPhotoId;
      const orderedPhotos = [
        location.photos.find((photo) => photo.id === coverId) || location.photos[0],
        ...location.photos.filter((photo) => photo.id !== coverId)
      ].slice(0, 3);

      const element = document.createElement("div");
      element.className = "photo-stack-marker";
      element.setAttribute("aria-label", `${location.name}，${location.photos.length} 张照片`);

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
          card.innerHTML = `<img src="${photo.thumb}" alt="" />`;
          button.appendChild(card);
        });

      const count = document.createElement("span");
      count.className = "photo-count";
      count.textContent = String(location.photos.length);
      button.appendChild(count);

      const label = document.createElement("span");
      label.className = "place-label";
      label.textContent = location.name;

      element.append(button, label);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectRef.current(location);
      });

      const marker = new Marker({ element, anchor: "bottom" })
        .setLngLat(location.coordinates)
        .addTo(map);
      marker.setOpacity(1, 0);
      markersRef.current.push(marker);
    });
  };

  // 数据或封面变化时重新渲染
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