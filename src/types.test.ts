import { expect, test, describe } from "bun:test";
import { Either } from "effect";
import { Schema } from "@effect/schema";

import { CurrencyCodeSchema, ServerResponseSchema } from "./types";

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
    expect(decoder("usd")).toBe(decoder("USD"));
  });

  test("code is consist of letters", () => {
    const decoder = Schema.decodeUnknownEither(CurrencyCodeSchema);

    expect(Either.isLeft(decoder("123"))).toBeTrue();
  });
});

describe("Server Response Schema", () => {
  // Test successful response parsing
  test("parses successful API response", () => {
    const mockSuccessResponse = {
      result: "success",
      time_last_update_unix: 1640995200,
      time_next_update_unix: 1641081600,
      base_code: "USD",
      rates: {
        EUR: 0.85,
        GBP: 0.75,
        JPY: 110.0,
      },
    };

    const parseEither = Schema.decodeUnknownEither(ServerResponseSchema);
    const result = parseEither(mockSuccessResponse);

    expect(Either.isRight(result)).toBeTrue();
    if (Either.isRight(result)) {
      expect(result.right.result).toBe("success");
    }
  });

  test("parses failed API response", () => {
    const mockFailedResponse = {
      result: "error",
      "error-type": "unsupported-code",
    };

    const parseEither = Schema.decodeUnknownEither(ServerResponseSchema);
    const result = parseEither(mockFailedResponse);

    expect(Either.isRight(result)).toBeTrue();
    if (Either.isRight(result)) {
      expect(result.right.result).toBe("error");
    }
  });
});
