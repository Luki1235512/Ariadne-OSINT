import { useEffect, useRef } from "react";

// Public OpenFreeMap style. Replaceable later with a self-hosted style.
// Any host used here must also be allowed in the CSP in nginx.conf.
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

// Centre of Poland. Longitude first.
const INITIAL_CENTER: [number, number] = [19.4, 52.1];
const INITIAL_ZOOM = 5.5;

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    // MapLibre is loaded on demand so it ends up in its own chunk.
    void (async () => {
      const [maplibre, worker] = await Promise.all([
        import("maplibre-gl"),
        // MapLibre 6 looks for its worker file next to its own module. Vite moves the
        // module in dev mode, so the worker would not be found. Give it the URL explicitly.
        import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
        import("maplibre-gl/dist/maplibre-gl.css"),
      ]);
      if (cancelled) {
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
      // Attribution is required by the tile provider. It sits bottom left so it never
      // collides with the side panel toggle on the right.
      map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-left");

      // Style, tile and font failures only show up here, so surface them.
      map.on("error", (event) => {
        console.error("Map error", event.error);
      });

      // The side panel can be collapsed, which changes the map's width.
      const observer = new ResizeObserver(() => {
        map.resize();
      });
      observer.observe(container);

      cleanup = () => {
        observer.disconnect();
        map.remove();
      };
    })().catch((error: unknown) => {
      console.error("Could not start the map", error);
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <div ref={containerRef} className="map" role="application" aria-label="Mapa" />;
}