import test from 'node:test';
import assert from 'node:assert/strict';
import { useIsolatedVersionedSync } from '../src/versionedSyncGate.js';

test('versioned sync requires explicit development opt-in and a loopback backend', () => {
  const enabled = { development: true, requested: 'true', supabaseUrl: 'http://127.0.0.1:54321' };
  assert.equal(useIsolatedVersionedSync(enabled), true);
  assert.equal(useIsolatedVersionedSync({ ...enabled, development: false }), false);
  assert.equal(useIsolatedVersionedSync({ ...enabled, requested: 'false' }), false);
  assert.equal(useIsolatedVersionedSync({ ...enabled, supabaseUrl: 'https://example.supabase.co' }), false);
  assert.equal(useIsolatedVersionedSync({ ...enabled, supabaseUrl: 'http://localhost.example.com' }), false);
  assert.equal(useIsolatedVersionedSync({ ...enabled, supabaseUrl: 'http://user:pass@localhost' }), false);
});
