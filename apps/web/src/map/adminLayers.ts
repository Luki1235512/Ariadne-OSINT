import type { MapLibreMap } from "maplibre-gl";

const ADMIN_TILES_MAX_ZOOM = 14;

export function addAdminLayers(map: MapLibreMap): void {
  map.addSource("admin", {
    type: "vector",
    tiles: [`${window.location.origin}/api/tiles/admin/{z}/{x}/{y}`],
    maxzoom: ADMIN_TILES_MAX_ZOOM,
    promoteId: "id",
  });

  map.addLayer({
    id: "admin-areas-fill",
    type: "fill",
    source: "admin",
    "source-layer": "areas",
    paint: { "fill-color": "#5b8def", "fill-opacity": 0.08 },
  });

  map.addLayer({
    id: "admin-areas-outline",
    type: "line",
    source: "admin",
    "source-layer": "areas",
    paint: { "line-color": "#8fb0f5", "line-width": 1, "line-opacity": 0.8 },
  });
}
