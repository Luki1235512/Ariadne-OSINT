import type { ColumnType, Generated } from "kysely";

type JsonObject = ColumnType<Record<string, unknown>, string, string>;
type Timestamp = ColumnType<Date, string | undefined, string>;
type CalendarDate = ColumnType<string, string, string>;

export interface ObjectTypesTable {
  name: string;
}

export interface LinkTypesTable {
  name: string;
}

export interface SourcesTable {
  id: string;
  name: string;
  publisher: string;
  url: string;
  license: string;
  license_url: string | null;
  retrieved_at: ColumnType<Date, string, string>;
  created_at: Generated<Date>;
}

export interface ObjectsTable {
  id: string;
  type: string;
  country_code: string | null;
  display_name: string;
  properties: JsonObject;
  created_at: Generated<Date>;
  updated_at: Timestamp;
}

export interface LinksTable {
  id: string;
  type: string;
  from_object_id: string;
  to_object_id: string;
  properties: JsonObject;
  valid_from: CalendarDate | null;
  valid_to: CalendarDate | null;
  confidence: number | null;
  created_at: Generated<Date>;
  updated_at: Timestamp;
}

export interface ObjectSourcesTable {
  object_id: string;
  source_id: string;
  record_ref: string;
}

export interface LinkSourcesTable {
  link_id: string;
  source_id: string;
  record_ref: string;
}

export interface SuppressionsTable {
  object_id: string;
  reason: string;
  created_at: Generated<Date>;
}

export interface Database {
  object_types: ObjectTypesTable;
  link_types: LinkTypesTable;
  sources: SourcesTable;
  objects: ObjectsTable;
  links: LinksTable;
  object_sources: ObjectSourcesTable;
  link_sources: LinkSourcesTable;
  suppressions: SuppressionsTable;
}
