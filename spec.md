## Effect Learning Progress & Currency Exchange CLI Assignment Specification

### What You've Learned About Effect

1. **Effect Type & Error Handling**

   - The Effect type: `Effect<A, E, R>` (Success, Error, Requirements)
   - Explicit error handling with typed errors
   - Using `Effect.gen` for readable imperative-style code
   - `Effect.flatMap` for chaining Effect operations

2. **HTTP Operations with @effect/platform**

   - Using `HttpClient` for making requests
   - Error handling with `HttpClientResponse.filterStatusOk`
   - Providing layers with `Effect.provide(NodeHttpClient.layer)`

3. **Schema Validation**

   - Creating schemas with `Schema.String`, `Schema.Array`, `Schema.Literal`
   - String transformations: `Schema.Uppercase`, `Schema.length()`
   - Composing schemas with `Schema.compose`
   - Understanding decode (external → internal) vs encode (internal → external)

4. **Dependency Injection**
   - Understanding Layers and Services
   - How `Effect.provide()` supplies dependencies
   - The concept of Requirements in Effect types

### Assignment: Currency Exchange Rate CLI Tool

**Technology Stack**: Bun + Effect-ts

**Project Setup**:

```bash
mkdir currency-cli
cd currency-cli
bun init -y
bun add effect @effect/platform @effect/platform-bun @effect/schema @effect/cli
bun add -d @types/bun
```

### Detailed Tasks

#### Task 1: Create the Core Types and Schemas

Create `src/types.ts`:

```typescript
import { Schema } from "@effect/schema";

// Define your schemas here:
// 1. Currency code schema (3-letter codes like "USD", "EUR")
// 2. Exchange rate response schema
// 3. Cached rate schema with timestamp

export const CurrencyCode = Schema.String
  .pipe
  // Add validation for 3-letter currency codes
  ();

// Define more schemas...
```

#### Task 2: Create a Cache Layer

Create `src/services/cache.ts`:

```typescript
import { Effect, Context, Layer } from "effect";
import { Database } from "bun:sqlite";

interface CacheService {
  get: (key: string) => Effect.Effect<string | null>;
  set: (key: string, value: string, ttlSeconds: number) => Effect.Effect<void>;
  clear: () => Effect.Effect<void>;
}

// Create a Context tag
// Implement CacheServiceLive using Bun's SQLite
// The cache should store: key, value, expiry timestamp
```

#### Task 3: Create an Exchange Rate Service

Create `src/services/exchange-rate.ts`:

```typescript
import { Effect, Context, Layer } from "effect";
import { HttpClient } from "@effect/platform";

interface ExchangeRateService {
  getRate: (
    from: string,
    to: string,
  ) => Effect.Effect<number, ExchangeRateError>;
  getRates: (
    base: string,
  ) => Effect.Effect<Record<string, number>, ExchangeRateError>;
}

// Define custom errors:
// - InvalidCurrencyError
// - ApiLimitError
// - NetworkError

// Use this free API: https://api.exchangerate-api.com/v4/latest/USD
// (No API key needed, but has rate limits)

// Implement the service with:
// 1. HTTP calls to the API
// 2. Caching to avoid rate limits
// 3. Proper error handling
```

#### Task 4: Create the CLI Application

Create `src/cli.ts`:

```typescript
import { Command, Options } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";

// Create CLI commands:
// 1. convert <amount> <from> <to> - Convert between currencies
// 2. rates <base> - Show all rates for a base currency
// 3. list - List supported currencies

const convert = Command.make(
  "convert",
  {
    amount: Options.float("amount"),
    from: Options.text("from"),
    to: Options.text("to"),
  },
  ({ amount, from, to }) =>
    Effect.gen(function* () {
      // Implement conversion logic
      // Should handle errors gracefully
    }),
);

// Create more commands...
```

#### Task 5: Put it All Together

Create `src/index.ts`:

```typescript
import { Effect, Layer, pipe } from "effect";
import { BunContext, BunRuntime } from "@effect/platform-bun";

// Compose all your layers
const MainLayer = Layer.merge(CacheServiceLive, ExchangeRateServiceLive);

// Run your CLI app
```

### Key Implementation Details

1. **Services use Context.GenericTag pattern**
2. **Layers provide service implementations**
3. **Use Effect.gen for readable async code**
4. **Handle errors explicitly with custom error types**
5. **Use concurrent operations where appropriate**

### Example Usage

When complete, your CLI should work like this:

```bash
# Convert currency
bun run src/index.ts convert 100 USD EUR
# Output: 100 USD = 92.45 EUR

# Get all rates for a currency
bun run src/index.ts rates GBP
# Output:
# GBP -> USD: 1.27
# GBP -> EUR: 1.16
# ...

# Handle errors gracefully
bun run src/index.ts convert 100 XYZ EUR
# Output: Error: Invalid currency code: XYZ

# Concurrent conversions (bonus)
bun run src/index.ts convert-many rates.json
# Where rates.json contains multiple conversion requests
```

### Starter Code for Exchange Rate Service

```typescript
import { Effect, Context, Layer, Data } from "effect";
import { HttpClient, HttpClientRequest } from "@effect/platform";
import type { HttpClientError } from "@effect/platform/HttpClientError";

// Custom errors
class InvalidCurrencyError extends Data.TaggedError("InvalidCurrencyError")<{
  currency: string;
}> {}

class ApiLimitError extends Data.TaggedError("ApiLimitError")<{
  retryAfter: number;
}> {}

// Start implementing here...
const ExchangeRateServiceLive = Layer.effect(
  ExchangeRateService,
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient;
    const cache = yield* CacheService;

    return {
      getRate: (from, to) =>
        Effect.gen(function* () {
          // 1. Check cache first
          // 2. If not cached, fetch from API
          // 3. Cache the result
          // 4. Return the rate
        }),
      // Implement getRates...
    };
  }),
);
```

### Bonus Challenges

1. **Add retry logic** with exponential backoff for API failures
2. **Implement bulk conversions** using `Effect.forEach` with concurrency limits
3. **Add a web server mode** using Bun.serve that exposes the same functionality as REST endpoints
4. **Create comprehensive tests** with mock layers

### Tips

- Use `Effect.gen` for readable imperative-style code
- Remember to handle all error cases explicitly
- Use `Effect.tap` for side effects like logging
- Leverage Bun's speed for quick iterations
- The cache prevents hitting API rate limits
