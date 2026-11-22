export interface AreaInView {
  id: string;
  name: string;
}

export interface RenderedArea {
  id?: string | number | undefined;
  properties: Record<string, unknown>;
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

export function areasInView(features: readonly RenderedArea[]): AreaInView[] {
  const byId = new Map<string, AreaInView>();
  for (const feature of features) {
    const name = feature.properties.name;
    if (typeof feature.id === "string" && typeof name === "string" && !byId.has(feature.id)) {
      byId.set(feature.id, { id: feature.id, name });
    }
  }
  return [...byId.values()].sort(
    (a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export function sameAreas(a: readonly AreaInView[], b: readonly AreaInView[]): boolean {
  return a.length === b.length && a.every((area, index) => area.id === b[index]?.id);
}
