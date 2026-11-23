ALTER TABLE tasks ADD COLUMN visibility TEXT NOT NULL DEFAULT 'shared'
  CHECK (visibility IN ('shared', 'private'));
ALTER TABLE tasks ADD COLUMN creator_uid TEXT REFERENCES partners(uid);

CREATE TRIGGER tasks_private_insert BEFORE INSERT ON tasks
WHEN NEW.visibility = 'private' AND (NEW.creator_uid IS NULL OR NEW.assignee_uid IS NOT NEW.creator_uid)
BEGIN
  SELECT RAISE(ABORT, 'invalid private task ownership');
END;

CREATE TRIGGER tasks_private_update BEFORE UPDATE ON tasks
WHEN NEW.visibility IS NOT OLD.visibility OR NEW.creator_uid IS NOT OLD.creator_uid
  OR (NEW.visibility = 'private' AND (NEW.creator_uid IS NULL OR NEW.assignee_uid IS NOT NEW.creator_uid))
BEGIN
  SELECT RAISE(ABORT, 'invalid private task ownership');
END;

ALTER TABLE board_metadata ADD COLUMN slot_1_revision INTEGER NOT NULL DEFAULT 0
  CHECK (slot_1_revision BETWEEN 0 AND 9007199254740991);
ALTER TABLE board_metadata ADD COLUMN slot_2_revision INTEGER NOT NULL DEFAULT 0
  CHECK (slot_2_revision BETWEEN 0 AND 9007199254740991);
UPDATE board_metadata SET slot_1_revision = revision, slot_2_revision = revision;

DROP TRIGGER partners_metadata_revision;
CREATE TRIGGER partners_metadata_revision AFTER UPDATE OF display_name, enabled ON partners
WHEN OLD.display_name IS NOT NEW.display_name OR OLD.enabled IS NOT NEW.enabled
BEGIN
  SELECT CASE WHEN (SELECT revision FROM board_metadata WHERE id=1) >= 9007199254740991
    THEN RAISE(ABORT, 'board revision overflow') END;
  UPDATE board_metadata SET revision = revision + 1,
    slot_1_revision = slot_1_revision + 1, slot_2_revision = slot_2_revision + 1 WHERE id = 1;
END;
