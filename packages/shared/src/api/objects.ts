export interface SourceSummary {
  id: string;
  name: string;
  publisher: string;
  url: string;
  license: string;
  licenseUrl: string | null;
  retrievedAt: string;
  recordRef: string | null;
}

export interface ObjectSummary {
  id: string;
  type: string;
  displayName: string;
}

export interface LinkDetails {
  id: string;
  type: string;
  direction: "outgoing" | "incoming";
  other: ObjectSummary;
  properties: Record<string, unknown>;
  validFrom: string | null;
  validTo: string | null;
  confidence: number | null;
  sources: SourceSummary[];
}

export interface ObjectDetails extends ObjectSummary {
  countryCode: string | null;
  properties: Record<string, unknown>;
  updatedAt: string;
  location: {
    point: [lon: number, lat: number];
    bbox: [west: number, south: number, east: number, north: number] | null;
    source: SourceSummary;
  } | null;
  sources: SourceSummary[];
  links: {
    total: number;
    items: LinkDetails[];
  };
}
