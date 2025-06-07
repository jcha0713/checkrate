import { Effect, Context, Layer, Data, Option } from "effect";
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
  set: (key: string, rateData: string) => Effect.Effect<void, DatabaseError>;
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
          cachedAt INTEGER NOT NULL
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

export const CacheServiceLive = Layer.effect(
  CacheService,
  Effect.gen(function* () {
    const db = yield* initDb("./cache.db");

    const get = (from: string) => {
      return Effect.gen(function* () {
        yield* Effect.logDebug(`Cache lookup for key: ${from}`);

        const query = db.query("SELECT * from cache WHERE key = $from");
        const result = query.get({ $from: from });

        if (!result) {
          yield* Effect.logDebug(`No cached value for key: ${from}`);
          return Option.none();
        }

        const validated = yield* Schema.decodeUnknown(CachedRateSchema)(result);

        yield* Effect.logDebug(`Cache hit for key: ${from}`);

        return Option.some(validated);
      });
    };

    const set = (key: string, rateData: string) => {
      return Effect.gen(function* () {
        yield* Effect.logDebug(`Setting cache for key: ${key}`);

        try {
          const insertSQL = `
            INSERT OR REPLACE INTO cache (key, rateData, cachedAt)
            VALUES ($key, $rateData, $now)
          `;

          const now = Math.floor(Date.now());

          const query = db.query(insertSQL);
          query.run({ $key: key, $rateData: rateData, $now: now });
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
  }),
);
