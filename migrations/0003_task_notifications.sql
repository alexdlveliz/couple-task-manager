CREATE TABLE notification_registrations (
  id TEXT PRIMARY KEY NOT NULL,
  partner_uid TEXT NOT NULL REFERENCES partners(uid),
  endpoint TEXT NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%'),
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  expiration_time INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  last_outcome TEXT
);
CREATE INDEX notification_registrations_partner ON notification_registrations(partner_uid, active);

CREATE TABLE notification_deadlines (
  task_id TEXT PRIMARY KEY NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  cycle_id TEXT NOT NULL,
  deadline TEXT NOT NULL
);
CREATE INDEX notification_deadlines_due ON notification_deadlines(deadline);
INSERT INTO notification_deadlines(task_id, cycle_id, deadline)
SELECT id, lower(hex(randomblob(16))), deadline FROM tasks WHERE deadline IS NOT NULL;

CREATE TABLE notification_overdue_dedup (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  cycle_id TEXT NOT NULL,
  recipient_uid TEXT NOT NULL REFERENCES partners(uid),
  PRIMARY KEY (task_id, cycle_id, recipient_uid)
);

CREATE TABLE notification_events (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('created', 'completed', 'changed', 'overdue')),
  revision INTEGER,
  recipient_uid TEXT NOT NULL REFERENCES partners(uid),
  cycle_id TEXT,
  changed_fields TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK ((type = 'overdue' AND cycle_id IS NOT NULL) OR (type <> 'overdue' AND revision IS NOT NULL))
);
CREATE UNIQUE INDEX notification_mutation_identity ON notification_events(task_id, revision, type, recipient_uid) WHERE type <> 'overdue';
CREATE UNIQUE INDEX notification_overdue_identity ON notification_events(task_id, cycle_id, recipient_uid) WHERE type = 'overdue';
CREATE INDEX notification_events_created ON notification_events(created_at);

CREATE TABLE notification_deliveries (
  event_id TEXT NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  registration_id TEXT NOT NULL REFERENCES notification_registrations(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'leased', 'accepted', 'abandoned')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TEXT NOT NULL,
  lease_expires_at TEXT,
  last_error TEXT,
  accepted_at TEXT,
  PRIMARY KEY (event_id, registration_id)
);
CREATE INDEX notification_deliveries_due ON notification_deliveries(state, next_attempt_at, lease_expires_at);
