import { Effect, Context, Layer, Data } from "effect";
import { Schema } from "@effect/schema";
import { HttpClient } from "@effect/platform";
import {
  CurrencyCodeSchema,
  CurrencyRateResponseSchema,
  type CachedRate,
} from "../types";
import type { HttpClientError } from "@effect/platform/HttpClientError";
import type { ParseError } from "@effect/schema/ParseResult";
import { CacheService, DatabaseError } from "./cache";

class UnsupportedCodeError extends Data.TaggedError("UnsupportedCodeError")<{
  currency: string;
}> {}

class ApiLimitError extends Data.TaggedError("ApiLimitError")<{
  retryAfter: number;
}> {}

type ExchangeRateError = UnsupportedCodeError | ApiLimitError | HttpClientError;

interface ExchangeRateService {
  getRate: (
    from: string,
    to: string,
  ) => Effect.Effect<number, ExchangeRateError | ParseError | DatabaseError>;
  getRates: (
    from: string,
  ) => Effect.Effect<
    Record<string, number>,
    ExchangeRateError | ParseError | DatabaseError
  >;
}

export const ExchangeRateService = Context.GenericTag<ExchangeRateService>(
  "ExchangeRateService",
);

export const ExchangeRateServiceLive = Layer.effect(
  ExchangeRateService,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const cache = yield* CacheService;

    const fetchRates = (from: string) => {
      return Effect.gen(function* () {
        const currencyCode =
          yield* Schema.decodeUnknown(CurrencyCodeSchema)(from);

        const url = new URL(
          `https://api.exchangerate-api.com/v4/latest/${currencyCode}`,
        );

        const response = yield* client.get(url);
        const json = yield* response.json;

        if (response.status !== 200) {
          return yield* new UnsupportedCodeError({ currency: from });
        }

        const result = Schema.decodeUnknownSync(CurrencyRateResponseSchema)(
          json,
        );

        yield* cache.set(from, JSON.stringify(result.rates));
        return result;
      });
    };

    const getRate = (from: string, to: string) => {
      return Effect.gen(function* () {
        const result = yield* fetchRates(from);
        const resultCode = yield* Schema.decodeUnknown(CurrencyCodeSchema)(to);
        return result.rates[resultCode] ?? -1;
      });
    };

    const getRates = (from: string) => {
      return Effect.gen(function* () {
        const result = yield* fetchRates(from);
        return result.rates;
      });
    };

    return {
      getRate,
      getRates,
    };
  }),
);
