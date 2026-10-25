CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE object_geometries (
    object_id text NOT NULL REFERENCES objects (id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('boundary', 'point')),
    geom geometry(Geometry, 4326) NOT NULL,
    source_id text NOT NULL REFERENCES sources (id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (object_id, kind),
    CHECK (ST_IsValid(geom)),
    CHECK (kind <> 'point' OR GeometryType(geom) = 'POINT'),
    CHECK (kind <> 'boundary' OR GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON'))
);

CREATE INDEX object_geometries_geom_idx ON object_geometries USING gist (geom);
CREATE INDEX object_geometries_source_idx ON object_geometries (source_id);
