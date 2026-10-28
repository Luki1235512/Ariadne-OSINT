import type { ExpressionSpecification, MapLayerMouseEvent, Map as MapLibreMap } from "maplibre-gl";

const ADMIN_TILES_MAX_ZOOM = 14;

const SOURCE = "admin";
const AREAS = "areas";
const FILL_LAYER = "admin-areas-fill";

const AREA_COLOR = "#8b5cf6";
const OUTLINE_COLOR = "#b794ff";
const ACCENT_COLOR = "#ff00e6";

const selected: ExpressionSpecification = ["boolean", ["feature-state", "selected"], false];
const hovered: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];

export function addAdminLayers(map: MapLibreMap): void {
  map.addSource(SOURCE, {
    type: "vector",
    tiles: [`${window.location.origin}/api/tiles/admin/{z}/{x}/{y}`],
    maxzoom: ADMIN_TILES_MAX_ZOOM,
    promoteId: "id",
  });

  map.addLayer({
    id: FILL_LAYER,
    type: "fill",
    source: SOURCE,
    "source-layer": AREAS,
    paint: {
      "fill-color": ["case", selected, ACCENT_COLOR, AREA_COLOR],
      "fill-opacity": ["case", selected, 0.16, hovered, 0.18, 0.06],
    },
  });

  map.addLayer({
    id: "admin-areas-outline",
    type: "line",
    source: SOURCE,
    "source-layer": AREAS,
    paint: {
      "line-color": ["case", selected, ACCENT_COLOR, OUTLINE_COLOR],
      "line-width": ["case", selected, 2.5, 1],
      "line-opacity": ["case", selected, 1, 0.7],
    },
  });
}

function featureId(event: MapLayerMouseEvent): string | undefined {
  const id = event.features?.[0]?.id;
  return typeof id === "string" ? id : undefined;
}

export function enableAdminInteraction(
  map: MapLibreMap,
  onSelect: (id: string | null) => void,
): () => void {
  let hoveredId: string | undefined;

  const setHover = (id: string | undefined) => {
    if (id === hoveredId) {
      return;
    }
    if (hoveredId !== undefined) {
      map.setFeatureState({ source: SOURCE, sourceLayer: AREAS, id: hoveredId }, { hover: false });
    }
    if (id !== undefined) {
      map.setFeatureState({ source: SOURCE, sourceLayer: AREAS, id }, { hover: true });
    }
    hoveredId = id;
    map.getCanvas().style.cursor = id === undefined ? "" : "pointer";
  };

  const onMove = (event: MapLayerMouseEvent) => {
    setHover(featureId(event));
  };
  const onLeave = () => {
    setHover(undefined);
  };
  const onClick = (event: MapLayerMouseEvent) => {
    const hits = map.queryRenderedFeatures(event.point, { layers: [FILL_LAYER] });
    const id = hits[0]?.id;
    onSelect(typeof id === "string" ? id : null);
  };

  map.on("mousemove", FILL_LAYER, onMove);
  map.on("mouseleave", FILL_LAYER, onLeave);
  map.on("click", onClick);
  return () => {
    map.off("mousemove", FILL_LAYER, onMove);
    map.off("mouseleave", FILL_LAYER, onLeave);
    map.off("click", onClick);
  };
}

export function showSelection(
  map: MapLibreMap,
  previousId: string | null,
  nextId: string | null,
): void {
  if (previousId !== null) {
    map.setFeatureState(
      { source: SOURCE, sourceLayer: AREAS, id: previousId },
      { selected: false },
    );
  }
  if (nextId !== null) {
    map.setFeatureState({ source: SOURCE, sourceLayer: AREAS, id: nextId }, { selected: true });
  }
}
