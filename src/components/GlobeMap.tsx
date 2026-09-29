import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, NavigationControl, AttributionControl } from "maplibre-gl";
import type { PhotoLocation } from "../data/demoPhotos";

type GlobeMapProps = {
  locations: PhotoLocation[];
  covers: Record<string, string>;
  activeLocationId?: string;
  onSelectLocation: (location: PhotoLocation) => void;
};

const mapStyle = import.meta.env.VITE_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";

export function GlobeMap({ locations, covers, activeLocationId, onSelectLocation }: GlobeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelectLocation);

  useEffect(() => {
    onSelectRef.current = onSelectLocation;
  }, [onSelectLocation]);

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
    map.setProjection({ type: "globe" });

    map.addControl(new NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: "© OpenStreetMap contributors"
      }),
      "bottom-left"
    );

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderMarkers = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      locations.forEach((location) => {
        const coverId = covers[location.id] || location.coverPhotoId;
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
            card.innerHTML = `<img src="${photo.image}" alt="" />`;
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
        markersRef.current.push(marker);
      });
    };

    if (map.loaded()) {
      renderMarkers();
    } else {
      map.once("load", renderMarkers);
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
