import { describe, test, expect } from "bun:test";
import { Effect, Option, Layer } from "effect";
import { CacheService, createCacheService } from "./cache";

describe("CacheService", () => {
  const CacheServiceTestLive = Layer.effect(
    CacheService,
    createCacheService(":memory:"),
  );

  test("stores and retrieves data", async () => {
    const program = Effect.gen(function* () {
      const cache = yield* CacheService;

      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour future
      yield* cache.set("USD", '{"rates": {"EUR": 0.85}}', futureTime);

      return yield* cache.get("USD");
    });

    const result = await Effect.runPromise(
      Effect.provide(program, CacheServiceTestLive),
    );

    expect(Option.isSome(result)).toBeTrue();
    if (Option.isSome(result)) {
      expect(result.value.key).toBe("USD");
      expect(result.value.rateData).toBe('{"rates": {"EUR": 0.85}}');
    }
  });

  test("returns none for missing keys", async () => {
    const program = Effect.gen(function* () {
      const cache = yield* CacheService;
      return yield* cache.get("NONEXISTENT");
    });

    const result = await Effect.runPromise(
      Effect.provide(program, CacheServiceTestLive),
    );

    expect(Option.isNone(result)).toBeTrue();
  });

  test("handles cache expiration", async () => {
    const program = Effect.gen(function* () {
      const cache = yield* CacheService;

      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      yield* cache.set("USD", '{"rates": {"EUR": 0.85}}', pastTime);

      return yield* cache.get("USD");
    });

    const result = await Effect.runPromise(
      Effect.provide(program, CacheServiceTestLive),
    );

    expect(Option.isNone(result)).toBeTrue();
  });

  test("clears all data", async () => {
    const program = Effect.gen(function* () {
      const cache = yield* CacheService;

      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      yield* cache.set("USD", "data1", futureTime);
      yield* cache.set("EUR", "data2", futureTime);

      yield* cache.clear();

      const usd = yield* cache.get("USD");
      const eur = yield* cache.get("EUR");

      return { usd, eur };
    });

    const result = await Effect.runPromise(
      Effect.provide(program, CacheServiceTestLive),
    );

    expect(Option.isNone(result.usd)).toBeTrue();
    expect(Option.isNone(result.eur)).toBeTrue();
  });
});
