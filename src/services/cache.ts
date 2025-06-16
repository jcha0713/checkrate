import { Effect, Context, Layer, Data, Option, Clock } from "effect";
import { Schema } from "@effect/schema";
import { Database } from "bun:sqlite";
import type { ParseError } from "@effect/schema/ParseResult";
import { type CachedRate, CachedRateSchema } from "../types";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  cause: unknown;
  message: string;
}> {}

interface CacheService {
  get: (
    key: string,
  ) => Effect.Effect<Option.Option<CachedRate>, ParseError, never>;
  set: (
    key: string,
    rateData: string,
    nextUpdateAt: number,
  ) => Effect.Effect<void, DatabaseError>;
  clear: () => Effect.Effect<void, DatabaseError>;
}

export const CacheService = Context.GenericTag<CacheService>("CacheService");

const initDb = (
  dbPath: string,
): Effect.Effect<Database, DatabaseError, never> => {
  return Effect.gen(function* () {
    yield* Effect.logInfo(`Initializing database at: ${dbPath}`);

    try {
      const db = new Database(dbPath);

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS cache (
          key TEXT PRIMARY KEY,
          rateData TEXT NOT NULL,
          nextUpdateAt INTEGER NOT NULL
        )
      `;

      db.run(createTableSQL);
      yield* Effect.logInfo("Database initialized successfully");

      return db;
    } catch (error) {
      return yield* Effect.fail(
        new DatabaseError({
          cause: error,
          message: `Failed to initialize database at ${dbPath}: ${error}`,
        }),
      );
    }
  });
};

const getCacheTimingInfo = (cachedEntry: typeof CachedRateSchema.Type) =>
  Clock.currentTimeMillis.pipe(
    Effect.map((millis) => {
      const now = Math.floor(millis / 1000);
      const nextUpdateAt = cachedEntry.nextUpdateAt;
      return {
        now,
        nextUpdateAt,
        shouldRefresh: now >= nextUpdateAt,
      };
    }),
  );

export const createCacheService = (dbPath: string) =>
  Effect.gen(function* () {
    const db = yield* initDb(dbPath);

    const get = (from: string) => {
      return Effect.gen(function* () {
        yield* Effect.logDebug(`Cache lookup for key: ${from}`);

        const query = db.query("SELECT * from cache WHERE key = $from");
        const result = query.get({ $from: from });

        if (!result) {
          yield* Effect.logDebug(`No cached value for key: ${from}`);
          return Option.none();
        }

        const validatedResult =
          yield* Schema.decodeUnknown(CachedRateSchema)(result);

        const timingInfo = yield* getCacheTimingInfo(validatedResult);

        if (timingInfo.shouldRefresh) {
          yield* Effect.logDebug(
            `Cache Refresh: Now: ${timingInfo.now} >= Next Update: ${timingInfo.nextUpdateAt}`,
          );
          return Option.none();
        }

        yield* Effect.logDebug(`Cache hit for key: ${from}`);

        return Option.some(validatedResult);
      });
    };

    const set = (key: string, rateData: string, nextUpdateAt: number) => {
      return Effect.gen(function* () {
        yield* Effect.logDebug(`Setting cache for key: ${key}`);

        try {
          const insertSQL = `
            INSERT OR REPLACE INTO cache (key, rateData, nextUpdateAt)
            VALUES ($key, $rateData, $nextUpdateAt)
          `;

          const query = db.query(insertSQL);
          query.run({
            $key: key,
            $rateData: rateData,
            $nextUpdateAt: nextUpdateAt,
          });
          yield* Effect.logInfo(`Cache updated for key: ${key}`);
        } catch (error) {
          return yield* Effect.fail(
            new DatabaseError({
              cause: error,
              message: `Failed to set cache entry: ${error}`,
            }),
          );
        }
      });
    };

    const clear = () => {
      return Effect.gen(function* () {
        yield* Effect.logInfo("Clearing all cache entries");

        try {
          db.run("DELETE FROM cache");
          yield* Effect.logInfo("Cache cleared successfully");
        } catch (error) {
          yield* Effect.logError("Failed to clear cache", error);
          return yield* Effect.fail(
            new DatabaseError({
              cause: error,
              message: `Failed to clear cache: ${error}`,
            }),
          );
        }
      });
    };

    return {
      get,
      set,
      clear,
    };
  });

export const CacheServiceLive = Layer.effect(
  CacheService,
  createCacheService("./cache.db"),
);
