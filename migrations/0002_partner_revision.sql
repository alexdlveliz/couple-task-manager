-- Partner display/assignment metadata participates in board snapshot freshness.
CREATE TRIGGER partners_metadata_revision AFTER UPDATE OF display_name, enabled ON partners
WHEN OLD.display_name IS NOT NEW.display_name OR OLD.enabled IS NOT NEW.enabled
BEGIN
  SELECT CASE WHEN (SELECT revision FROM board_metadata WHERE id=1) >= 9007199254740991 THEN RAISE(ABORT, 'board revision overflow') END;
  UPDATE board_metadata SET revision = revision + 1 WHERE id = 1;
END;
