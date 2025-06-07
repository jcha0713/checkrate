import { Effect, Context, Data, Layer } from "effect";

class ArgumentError extends Data.TaggedError("ArgumentError")<{
  message: string;
}> {}

interface CommandLineService {
  getArgs: () => Effect.Effect<
    {
      readonly from: string;
      readonly to?: string;
    },
    ArgumentError
  >;
}

export const CommandLineService =
  Context.GenericTag<CommandLineService>("CommandLineService");

const parseCommandLineArgs = () => {
  const args = Bun.argv.slice(2);

  if (args.length === 1 && args[0]) {
    const [from] = args;
    return Effect.succeed({ from });
  } else if (args.length === 2 && args[0] && args[1]) {
    const [from, to] = args;
    return Effect.succeed({ from, to });
  }

  return Effect.fail(
    new ArgumentError({
      message:
        "Please provide both from and to currency codes. Usage: bun run index.ts <from> <to>",
    }),
  );
};

export const CommandLineServiceLive = Layer.effect(
  CommandLineService,
  Effect.succeed({ getArgs: parseCommandLineArgs }),
);
