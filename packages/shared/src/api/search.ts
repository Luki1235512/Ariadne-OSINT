import type { ObjectSummary } from "./objects.js";

export interface SearchResult extends ObjectSummary {
  parent: ObjectSummary | null;
}

export interface SearchResponse {
  results: SearchResult[];
}
