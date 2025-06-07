import { Schema } from "@effect/schema";

export const CurrencyCodeSchema = Schema.Uppercase.pipe(
  Schema.length(3),
  Schema.pattern(/^[A-Z]+$/),
  Schema.brand("CurrencyCode"),
).annotations({
  message: () =>
    `Error: Check out 'https://www.exchangerate-api.com/docs/supported-currencies' to see a list of valid currency codes`,
});

export const CurrencyRateResponseSchema = Schema.Struct({
  date: Schema.String,
  time_last_updated: Schema.Number,
  base: Schema.String,
  rates: Schema.Record({
    key: Schema.String,
    value: Schema.Number,
  }),
});

export const CachedRateSchema = Schema.Struct({
  key: Schema.String, // e.g., "USD"
  rateData: Schema.String, // JSON stringified rate data
  cachedAt: Schema.Number, // Unix timestamp when cached
}).annotations({
  message: () => "Does not match with cached value",
});

export type CachedRate = Schema.Schema.Type<typeof CachedRateSchema>;
