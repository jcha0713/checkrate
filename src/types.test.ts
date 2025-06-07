import { expect, test, describe } from "bun:test";
import { Either } from "effect";
import { Schema } from "@effect/schema";

import { CurrencyCodeSchema } from "./types";

describe("currency code schema", () => {
  test("currency code is a 3-letter code", () => {
    const decoder = Schema.decodeUnknownEither(CurrencyCodeSchema);

    expect(Either.isRight(decoder("USD"))).toBeTrue();
    expect(Either.isRight(decoder("EUR"))).toBeTrue();

    expect(Either.isLeft(decoder("ABCD"))).toBeTrue();
    expect(Either.isLeft(decoder(""))).toBeTrue();
    expect(Either.isLeft(decoder("12"))).toBeTrue();
  });

  test("code gets converted to uppercase letters", () => {
    const decoder = Schema.decodeUnknownSync(CurrencyCodeSchema);
    const value = decoder("usd");
    expect(decoder("usd")).toBe(decoder("USD"));
  });

  test("code is consist of letters", () => {
    const decoder = Schema.decodeUnknownEither(CurrencyCodeSchema);

    expect(Either.isLeft(decoder("123"))).toBeTrue();
  });
});
