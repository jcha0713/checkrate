import { Effect, Option, Console } from "effect";
import { Args, CliConfig, Command, Options } from "@effect/cli";
import { FetchHttpClient } from "@effect/platform";
import {
  ExchangeRateService,
  ExchangeRateServiceLive,
} from "./src/services/exchangeRate";
import { CacheServiceLive } from "./src/services/cache";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import type { CurrencyRateResponse } from "./src/types";

const amount = Args.integer({ name: "amount" }).pipe(Args.withDefault(1));
const from = Args.text({ name: "from" });
const to = Args.text({ name: "to" }).pipe(Args.optional);
const json = Options.boolean("json").pipe(
  Options.withDefault(false),
  Options.withAlias("j"),
);

const createFormatter = (from: string, amount: number, isJson: boolean) => ({
  single: (to: string, rate: number) => {
    const result = (amount * rate).toFixed(4);
    if (isJson) {
      return { base: from.toUpperCase(), [to.toUpperCase()]: result };
    }
    return `${amount} ${from.toUpperCase()} → ${result} ${to.toUpperCase()}`;
  },
  all: (rates: CurrencyRateResponse["rates"]) => {
    if (isJson) {
      return {
        base: from.toUpperCase(),
        rates,
      };
    }

    const header = `${from.toUpperCase()}:\n`;
    const conversions = Object.entries(rates).map(([currency, rate]) => ({
      currency,
      amount: (rate * amount).toFixed(4),
    }));

    const maxWidth = Math.max(...conversions.map((c) => c.amount.length));

    const rows = conversions
      .map(
        ({ currency, amount }) => `  ${amount.padStart(maxWidth)} ${currency}`,
      )
      .join("\n");

    return header + rows;
  },
});

const currencyCommand = Command.make(
  "currency",
  {
    amount,
    json,
    from,
    to,
  },
  ({ amount, json, from, to }) =>
    Effect.gen(function* () {
      const exchangeRate = yield* ExchangeRateService;
      const formatter = createFormatter(from, amount, json);

      if (Option.isSome(to)) {
        const rate = yield* exchangeRate.getRate(from, to.value);
        const response = formatter.single(to.value, rate);

        yield* Console.log(response);
      } else {
        const response = yield* exchangeRate
          .getRates(from)
          .pipe(Effect.map(formatter.all));

        yield* Console.log(response);
      }
    }).pipe(
      Effect.catchTags({
        ParseError: (error) => Console.error(error.message),
        InvalidFromCurrencyCodeError: (error) =>
          Console.error(
            `InvalidFromCurrencyCodeError: "${error.currency}" is not a valid code. Please check again.`,
          ),
        InvalidToCurrencyCodeError: (error) =>
          Console.error(
            `InvalidToCurrencyCodeError: "${error.currency}" is not a valid code. Please check again.`,
          ),
        UnsupportedCodeError: (error) =>
          Console.error(
            `${error.name}: Check out 'https://www.exchangerate-api.com/docs/supported-currencies' to see a list of valid currency codes`,
          ),
      }),
      Effect.catchAll((error) => Console.error(error.message)),
    ),
);

const cli = Command.run(currencyCommand, {
  name: "Currency Converter CLI",
  version: "v0.0.1",
});

cli(process.argv).pipe(
  Effect.provide(ExchangeRateServiceLive),
  Effect.provide(CacheServiceLive),
  Effect.provide(FetchHttpClient.layer),
  Effect.provide(BunContext.layer),
  Effect.provide(CliConfig.layer({ showBuiltIns: false })),
  Effect.catchIf(
    (error) => error._tag !== "DatabaseError",
    () =>
      Console.error("Invalid command format: Use --help for more information"),
  ),
  BunRuntime.runMain,
);
