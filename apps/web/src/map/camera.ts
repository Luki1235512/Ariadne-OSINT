import type { ObjectDetails } from "@ariadne/shared";
import type { Map as MapLibreMap } from "maplibre-gl";

export interface FocusTarget {
  id: string;
  point: [number, number];
  bbox: [number, number, number, number] | null;
  adminLevel: number | null;
}

export function toFocusTarget(object: ObjectDetails): FocusTarget | null {
  if (object.location === null) {
    return null;
  }
  const level = object.properties.adminLevel;
  return {
    id: object.id,
    point: object.location.point,
    bbox: object.location.bbox,
    adminLevel: typeof level === "number" ? level : null,
  };
}

const MAX_ZOOM = 14;

export function zoomRangeForLevel(level: number | null): [min: number, max: number] {
  if (level === 1) {
    return [0, 6.9];
  }
  if (level === 2) {
    return [7, 8.9];
  }
  if (level === 3) {
    return [9, MAX_ZOOM];
  }
  return [0, MAX_ZOOM];
}

export function focusZoom(fittingZoom: number, level: number | null): number {
  const [min, max] = zoomRangeForLevel(level);
  return Math.min(Math.max(fittingZoom, min), max);
}

const PADDING = { top: 40, bottom: 40, left: 40, right: 360 };

export function moveTo(map: MapLibreMap, target: FocusTarget): void {
  const camera =
    target.bbox === null ? undefined : map.cameraForBounds(target.bbox, { padding: PADDING });
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  map.easeTo({
    center: camera?.center ?? target.point,
    zoom: focusZoom(camera?.zoom ?? map.getZoom(), target.adminLevel),
    duration: reduceMotion ? 0 : 800,
  });
}
