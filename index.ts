import { Effect, Option } from "effect";
import { FetchHttpClient } from "@effect/platform";
import {
  ExchangeRateService,
  ExchangeRateServiceLive,
} from "./src/services/exchangeRate";
import { CommandLineService, CommandLineServiceLive } from "./src/services/cli";
import { CacheService, CacheServiceLive } from "./src/services/cache";

const program = Effect.gen(function* () {
  const cli = yield* CommandLineService;
  const { from, to } = yield* cli.getArgs();

  const cache = yield* CacheService;
  const cachedResult = yield* cache.get(from);

  if (Option.isSome(cachedResult)) {
    return JSON.parse(cachedResult.value.rateData);
  }

  const exchangeRate = yield* ExchangeRateService;
  if (to) {
    return yield* exchangeRate.getRate(from, to);
  } else {
    return yield* exchangeRate.getRates(from);
  }
}).pipe(
  Effect.catchTags({
    ArgumentError: (error) => Effect.succeed(error.message),
    ParseError: (error) => Effect.succeed(error.message),
    UnsupportedCodeError: (error) =>
      Effect.succeed(
        `${error.name}: Check out 'https://www.exchangerate-api.com/docs/supported-currencies' to see a list of valid currency codes`,
      ),
  }),
  Effect.catchAll((error) => Effect.succeed(error.message)),
);

const programWithLayer = program.pipe(
  Effect.provide(CommandLineServiceLive),
  Effect.provide(ExchangeRateServiceLive),
  Effect.provide(CacheServiceLive),
  Effect.provide(FetchHttpClient.layer),
);

Effect.runPromise(programWithLayer).then((msg) => console.log(msg));
