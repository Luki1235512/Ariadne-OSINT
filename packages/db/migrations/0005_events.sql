INSERT INTO object_types (name) VALUES ('Event');

CREATE TABLE object_times (
    object_id text PRIMARY KEY REFERENCES objects (id) ON DELETE CASCADE,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz,
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX object_times_starts_at_idx ON object_times (starts_at);
