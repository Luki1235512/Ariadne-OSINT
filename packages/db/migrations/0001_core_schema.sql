CREATE TABLE object_types (
    name text PRIMARY KEY CHECK (name ~ '^[A-Z][A-Za-z]*$')
);

CREATE TABLE link_types (
    name text PRIMARY KEY CHECK (name ~ '^[a-z][a-z_]*$')
);

CREATE TABLE sources (
    id text PRIMARY KEY,
    name text NOT NULL,
    publisher text NOT NULL,
    url text NOT NULL,
    license text NOT NULL,
    license_url text,
    retrieved_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE objects (
    id text PRIMARY KEY,
    type text NOT NULL REFERENCES object_types (name),
    country_code text CHECK (country_code ~ '^[A-Z]{2}$'),
    display_name text NOT NULL CHECK (btrim(display_name) <> ''),
    properties jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(properties) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE links (
    id text PRIMARY KEY,
    type text NOT NULL REFERENCES link_types (name),
    from_object_id text NOT NULL REFERENCES objects (id) ON DELETE CASCADE,
    to_object_id text NOT NULL REFERENCES objects (id) ON DELETE CASCADE,
    properties jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(properties) = 'object'),
    valid_from date,
    valid_to date,
    confidence double precision CHECK (confidence BETWEEN 0 AND 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (from_object_id <> to_object_id),
    CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);

CREATE INDEX links_from_object_type_idx ON links (from_object_id, type);
CREATE INDEX links_to_object_type_idx ON links (to_object_id, type);

CREATE TABLE object_sources (
    object_id text NOT NULL REFERENCES objects (id) ON DELETE CASCADE,
    source_id text NOT NULL REFERENCES sources (id),
    record_ref text NOT NULL,
    PRIMARY KEY (object_id, source_id)
);
CREATE INDEX object_sources_source_idx ON object_sources (source_id);

CREATE TABLE link_sources (
    link_id text NOT NULL REFERENCES links (id) ON DELETE CASCADE,
    source_id text NOT NULL REFERENCES sources (id),
    record_ref text NOT NULL,
    PRIMARY KEY (link_id, source_id)
);
CREATE INDEX link_sources_source_idx ON link_sources (source_id);

CREATE TABLE suppressions (
    object_id text PRIMARY KEY,
    reason text NOT NULL CHECK (btrim(reason) <> ''),
    created_at timestamptz NOT NULL DEFAULT now()
);
