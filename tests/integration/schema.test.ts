import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('D1 schema', () => {
  it('applies migrations and begins with a single zero revision', async () => {
    const row = await env.DB.prepare('SELECT revision FROM board_metadata WHERE id = 1').first<{ revision: number }>();
    expect(row?.revision).toBe(0);
  });
  it('enforces two slots, unique UIDs and task assignment', async () => {
    await env.DB.prepare("INSERT INTO partners (slot,uid,display_name,enabled) VALUES (1,'a','Ana',1),(2,'b','Bea',1)").run();
    await expect(env.DB.prepare("INSERT INTO partners VALUES (3,'c','C',1)").run()).rejects.toThrow();
    await expect(env.DB.prepare("INSERT INTO tasks VALUES ('id','Task','missing','todo',NULL,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')").run()).rejects.toThrow();
  });
});
