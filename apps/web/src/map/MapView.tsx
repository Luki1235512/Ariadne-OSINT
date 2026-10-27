import { useEffect, useRef } from "react";
import { addAdminLayers } from "./adminLayers";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

const INITIAL_CENTER: [number, number] = [19.4, 52.1];
const INITIAL_ZOOM = 5.5;

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    const abort = new AbortController();
    let cleanup: (() => void) | undefined;

    void (async () => {
      const [maplibre, worker] = await Promise.all([
        import("maplibre-gl"),
        import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
        import("maplibre-gl/dist/maplibre-gl.css"),
      ]);
      if (abort.signal.aborted) {
        return;
      }
      maplibre.setWorkerUrl(worker.default);

      const map = new maplibre.Map({
        container,
        style: STYLE_URL,
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        attributionControl: false,
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-left");
      map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-left");

      map.on("load", () => {
        addAdminLayers(map);
      });

      map.on("error", (event) => {
        console.error("Map error", event.error);
      });

      cleanup = () => {
        map.remove();
      };
    })().catch((error: unknown) => {
      console.error("Could not start the map", error);
    });

    return () => {
      abort.abort();
      cleanup?.();
    };
  }, []);

  return <div ref={containerRef} className="map" role="application" aria-label="Map" />;
}
