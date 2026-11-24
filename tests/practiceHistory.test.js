import { test } from "node:test";
import assert from "node:assert/strict";
import { archivePractice, packPracticeMessages, unpackPracticeMessages } from "../src/practiceHistory.js";

test("switching conversations preserves the previous messages in the same backup record", () => {
  const old = [{ id: "one", role: "assistant", turn: { reply: "Hallo" } }, { role: "user", text: "Guten Tag" }];
  const active = [{ id: "two", role: "assistant", turn: { reply: "Willkommen" } }];
  const history = archivePractice([], "interview", old);
  const packed = packPracticeMessages(active, history);
  const restored = unpackPracticeMessages(JSON.parse(JSON.stringify(packed)));
  assert.deepEqual(restored, { messages: active, history });
  assert.equal(archivePractice(history, "interview", old).length, 1);
  assert.deepEqual(unpackPracticeMessages(old), { messages: old, history: [] });
});
