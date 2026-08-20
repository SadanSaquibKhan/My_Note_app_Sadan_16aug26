-- Margin sync — the light-data store (NO audio blobs).
-- One row per synced record. body is the record's JSON with any blob stripped.

CREATE TABLE IF NOT EXISTS records (
  store       TEXT    NOT NULL,          -- notebooks | sections | notes | assets | meta | groups | practices
  id          TEXT    NOT NULL,          -- the record's own id
  updated_at  INTEGER NOT NULL,          -- lastEdited in ms (the merge clock)
  deleted     INTEGER NOT NULL DEFAULT 0,-- 1 if this is a tombstone
  device      TEXT,                      -- editedOn, so a device can ignore its own echoes
  body        TEXT    NOT NULL,          -- JSON of the record, blob removed
  PRIMARY KEY (store, id)
);

-- pull asks "everything changed since <cursor>"; this index makes that fast.
CREATE INDEX IF NOT EXISTS idx_records_updated ON records (updated_at);
