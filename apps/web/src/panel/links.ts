import type { LinkDetails, SourceSummary } from "@ariadne/shared";

const LINK_LABELS: Record<string, { outgoing: string; incoming: string }> = {
  located_in: { outgoing: "Located in", incoming: "Contains" },
};

export interface LinkGroup {
  key: string;
  label: string;
  links: LinkDetails[];
  sources: SourceSummary[];
}

export function groupLinks(links: LinkDetails[]): LinkGroup[] {
  const groups = new Map<string, LinkGroup>();
  for (const link of links) {
    const key = `${link.direction}:${link.type}`;
    let group = groups.get(key);
    if (group === undefined) {
      const labels = LINK_LABELS[link.type];
      group = {
        key,
        label: labels === undefined ? `${link.type} (${link.direction})` : labels[link.direction],
        links: [],
        sources: [],
      };
      groups.set(key, group);
    }
    group.links.push(link);
    for (const source of link.sources) {
      if (!group.sources.some((known) => known.id === source.id)) {
        group.sources.push(source);
      }
    }
  }
  return [...groups.values()];
}

export function confidenceLabel(confidence: number | null): string | undefined {
  return confidence === null
    ? undefined
    : `inferred, ${String(Math.round(confidence * 100))} % confidence`;
}
