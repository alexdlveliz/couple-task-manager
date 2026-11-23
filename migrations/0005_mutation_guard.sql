-- Correlate deadline maintenance with the successful metadata update in its batch.
ALTER TABLE board_metadata ADD COLUMN mutation_token TEXT;
