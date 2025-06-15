import { Effect, Context, Layer, Data, Option } from "effect";
import { Schema } from "@effect/schema";
import { HttpClient } from "@effect/platform";
import { CurrencyCodeSchema, CurrencyRateResponseSchema } from "../types";
import type { HttpClientError } from "@effect/platform/HttpClientError";
import type { ParseError } from "@effect/schema/ParseResult";
import { type DatabaseError, CacheService } from "./cache";

class UnsupportedCodeError extends Data.TaggedError("UnsupportedCodeError")<{
  currency: string;
}> {}

class ApiLimitError extends Data.TaggedError("ApiLimitError")<{
  retryAfter: number;
}> {}

export class InvalidFromCurrencyCodeError extends Data.TaggedError(
  "InvalidFromCurrencyCodeError",
)<{
  readonly currency: string;
}> {}

export class InvalidToCurrencyCodeError extends Data.TaggedError(
  "InvalidToCurrencyCodeError",
)<{
  readonly currency: string;
}> {}

type ExternalError = UnsupportedCodeError | ApiLimitError | HttpClientError;

type ClientSideError = ParseError;

interface ExchangeRateService {
  getRate: (
    from: string,
    to: string,
  ) => Effect.Effect<
    number,
    | ExternalError
    | ClientSideError
    | InvalidFromCurrencyCodeError
    | InvalidToCurrencyCodeError
    | DatabaseError
  >;
  getRates: (
    from: string,
  ) => Effect.Effect<
    Record<string, number>,
    ExternalError | ParseError | InvalidFromCurrencyCodeError | DatabaseError
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
        const currencyCode = yield* Schema.decodeUnknown(CurrencyCodeSchema)(
          from,
        ).pipe(
          Effect.mapError(
            () =>
              new InvalidFromCurrencyCodeError({
                currency: from,
              }),
          ),
        );

        const cachedResult = yield* cache.get(from);

        if (Option.isSome(cachedResult)) {
          yield* Effect.logDebug("Use cached value");

          const parsed = Schema.parseJson(CurrencyRateResponseSchema);
          const decode = Schema.decodeUnknown(parsed);

          return yield* decode(cachedResult.value.rateData);
        }

        const url = new URL(
          `https://open.er-api.com/v6/latest/${currencyCode}`,
        );

        const response = yield* client.get(url);
        const json = yield* response.json;

        if (response.status !== 200) {
          return yield* new UnsupportedCodeError({ currency: from });
        }

        const result = Schema.decodeUnknownSync(CurrencyRateResponseSchema)(
          json,
        );

        yield* cache.set(
          from,
          JSON.stringify(result),
          result.time_next_update_unix,
        );
        return result;
      });
    };

    const getRate = (from: string, to: string) => {
      return Effect.gen(function* () {
        const result = yield* fetchRates(from);
        const resultCode = yield* Schema.decodeUnknown(CurrencyCodeSchema)(
          to,
        ).pipe(
          Effect.mapError(
            () =>
              new InvalidToCurrencyCodeError({
                currency: to,
              }),
          ),
        );
        const rate = result.rates[resultCode];

        if (!rate) {
          return yield* Effect.fail(
            new InvalidToCurrencyCodeError({ currency: to }),
          );
        }
        return rate;
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
