import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { addAdminLayers, enableAdminInteraction, showSelection } from "./adminLayers";
import { type FocusTarget, moveTo } from "./camera";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

const INITIAL_CENTER: [number, number] = [19.4, 52.1];
const INITIAL_ZOOM = 5.5;

interface MapViewProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  focus: FocusTarget | null;
}

export function MapView({ selectedId, onSelect, focus }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

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

      const instance = new maplibre.Map({
        container,
        style: STYLE_URL,
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        attributionControl: false,
      });
      instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-left");
      instance.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-left");

      let disableInteraction: (() => void) | undefined;
      instance.on("load", () => {
        addAdminLayers(instance);
        disableInteraction = enableAdminInteraction(instance, (id) => {
          onSelectRef.current(id);
        });
        setMap(instance);
      });

      instance.on("error", (event) => {
        console.error("Map error", event.error);
      });

      cleanup = () => {
        disableInteraction?.();
        setMap(null);
        instance.remove();
      };
    })().catch((error: unknown) => {
      console.error("Could not start the map", error);
    });

    return () => {
      abort.abort();
      cleanup?.();
    };
  }, []);

  const shownRef = useRef<string | null>(null);
  useEffect(() => {
    if (map === null) {
      return;
    }
    showSelection(map, shownRef.current, selectedId);
    shownRef.current = selectedId;
  }, [map, selectedId]);

  const movedToRef = useRef<string | null>(null);
  useEffect(() => {
    if (map === null || focus === null) {
      movedToRef.current = null;
      return;
    }
    if (movedToRef.current === focus.id) {
      return;
    }
    moveTo(map, focus);
    movedToRef.current = focus.id;
  }, [map, focus]);

  return <div ref={containerRef} className="map" role="application" aria-label="Map" />;
}
