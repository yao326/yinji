import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, NavigationControl, AttributionControl, setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { PhotoLocation } from "../data/types";

type GlobeMapProps = {
  locations: PhotoLocation[];
  covers: Record<string, string>;
  activeLocationId?: string;
  onSelectLocation: (location: PhotoLocation) => void;
};

type Cluster = {
  id: string;
  name: string;
  country: string;
  coordinates: [number, number];
  coverPhotoId: string;
  photos: PhotoLocation["photos"];
  members: PhotoLocation[];
};

const mapStyle = import.meta.env.VITE_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
setWorkerUrl(maplibreWorkerUrl);

function addSatelliteBase(map: MapLibreMap) {
  if (map.getSource("satellite")) return;
  const style = map.getStyle();
  if (!style || !style.layers) return;

  map.setPaintProperty("background", "background-color", "#0b2438");
  map.setPaintProperty("background", "background-opacity", 1);

  // 隐藏矢量填充层，减少每帧渲染负担（保留道路/地名）
  style.layers.forEach((layer: any) => {
    if (layer.type === "fill") {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  });

  // 移除内置自然地球底图（已被卫星影像替代），少加载一整套瓦片
  try {
    const natural = style.layers.filter((layer) => layer.id === "natural_earth") as any[];
    for (const layer of natural) {
      if (map.getLayer(layer.id)) map.removeLayer(layer.id);
      if (layer.source && map.getSource(layer.source)) map.removeSource(layer.source);
    }
  } catch {
    // 忽略：删不掉也不影响使用
  }

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
    map.addLayer({ id: "satellite-base", type: "raster", source: "satellite", paint: { "raster-fade-duration": 0 } }, beforeLayer);
  } else {
    map.addLayer({ id: "satellite-base", type: "raster", source: "satellite", paint: { "raster-fade-duration": 0 } });
  }
}

// 两点近似距离（经纬度，考虑纬度对经度的压缩）
function approxDistance(a: [number, number], b: [number, number]): number {
  const midLat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dLat = a[1] - b[1];
  const dLng = (a[0] - b[0]) * Math.cos(midLat);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// 当前缩放级别下的合并半径（度）：zoom 越小合并越猛，zoom 越大越精细
function mergeRadius(zoom: number): number {
  return 30 / Math.pow(2, zoom);
}

function clusterLocations(locations: PhotoLocation[], zoom: number): Cluster[] {
  const radius = mergeRadius(zoom);
  const groups: Cluster[] = [];

  for (const loc of locations) {
    let hit: Cluster | undefined;
    for (const g of groups) {
      if (approxDistance(g.coordinates, loc.coordinates) <= radius) {
        hit = g;
        break;
      }
    }

    if (hit) {
      hit.members.push(loc);
      hit.photos.push(...loc.photos);
      const n = hit.members.length;
      hit.coordinates = [
        (hit.coordinates[0] * (n - 1) + loc.coordinates[0]) / n,
        (hit.coordinates[1] * (n - 1) + loc.coordinates[1]) / n
      ];
    } else {
      groups.push({
        id: loc.id,
        name: loc.name,
        country: loc.country,
        coordinates: loc.coordinates,
        coverPhotoId: loc.coverPhotoId,
        photos: [...loc.photos],
        members: [loc]
      });
    }
  }

  return groups;
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

    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
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
      zoomTimer = setTimeout(() => renderAllRef.current(), 120);
    };

    map.on("zoom", scheduleRender);
    map.once("load", () => {
      addSatelliteBase(map);
      map.setProjection({ type: "globe" });
      renderAllRef.current();
    });

    return () => {
      map.off("zoom", scheduleRender);
      if (zoomTimer) clearTimeout(zoomTimer);
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

    const zoom = map.getZoom();
    const clusters = clusterLocations(locationsRef.current, zoom);

    clusters.forEach((cluster) => {
      const member = cluster.members[0];
      const coverId = coversRef.current[member.id] || member.coverPhotoId;
      const orderedPhotos = [
        cluster.photos.find((photo) => photo.id === coverId) || cluster.photos[0],
        ...cluster.photos.filter((photo) => photo.id !== coverId)
      ].slice(0, 3);

      const element = document.createElement("div");
      element.className = "photo-stack-marker";

      const isCluster = cluster.members.length > 1;
      const labelText = isCluster ? `${cluster.members.length} 个地点` : cluster.name;

      element.setAttribute("aria-label", `${labelText}，${cluster.photos.length} 张照片`);

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
            center: cluster.coordinates,
            zoom: Math.min(map.getZoom() + 2, 11),
            duration: 700,
            essential: true
          });
        } else {
          onSelectRef.current(member);
        }
      });

      const marker = new Marker({ element, anchor: "bottom" })
        .setLngLat(cluster.coordinates)
        .addTo(map);
      marker.setOpacity(1, 0);
      markersRef.current.push(marker);
    });
  };

  // 数据或封面变化时重新渲染
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapRef.current.loaded()) {
      renderAllRef.current();
    }
  }, [locations, covers]);

  useEffect(() => {
    if (!activeLocationId || !mapRef.current) return;
    const location = locations.find((item) => item.id === activeLocationId);
    if (!location) return;

    mapRef.current.flyTo({
      center: location.coordinates,
      zoom: 5.2,
      pitch: 42,
      duration: 950,
      essential: true
    });
  }, [activeLocationId, locations]);

  return <div ref={containerRef} className="globe-map" />;
}