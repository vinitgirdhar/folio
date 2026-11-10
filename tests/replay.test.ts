import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionBounds, tradesThrough } from "../src/shared/replay";
import { generateTrades } from "../src/server/mock";
test("replay is inclusive, preserves source order and leaves its snapshot unchanged", () => {
  const source = generateTrades(0, 0, 3).reverse();
  const saved = structuredClone(source);
  const bounds = sessionBounds(source);
  assert.equal(bounds.start, Date.parse(source[2].timestamp));
  assert.equal(bounds.end, Date.parse(source[0].timestamp));
  assert.deepEqual(
    tradesThrough(source, Date.parse(source[1].timestamp)),
    source.slice(1),
  );
  assert.deepEqual(tradesThrough(source, bounds.start - 1), []);
  assert.deepEqual(tradesThrough(source, bounds.end), source);
  assert.deepEqual(source, saved);
  assert.deepEqual(sessionBounds([]), { start: 0, end: 0 });
});
