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
  time_last_update_unix: Schema.Number,
  time_next_update_unix: Schema.Number,
  base_code: Schema.String,
  rates: Schema.Record({
    key: Schema.String,
    value: Schema.Number,
  }),
});

export type CurrencyRateResponse = Schema.Schema.Type<
  typeof CurrencyRateResponseSchema
>;

export const CachedRateSchema = Schema.Struct({
  key: Schema.String, // e.g., "USD"
  rateData: Schema.String, // JSON stringified rate data
  nextUpdateAt: Schema.Number, // Unix timestamp when to update
}).annotations({
  message: () => "Does not match with cached value",
});

export type CachedRate = Schema.Schema.Type<typeof CachedRateSchema>;
