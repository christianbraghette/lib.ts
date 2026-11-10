# easylib.ts

Java-style collections, lazy streams, and `Optional` and `Result` types for TypeScript.

- **Collections:** `ArrayList`, `SortedArrayList`, `PriorityQueue`, `HashSet`, `TreeSet`, `HashMap`, `TreeMap` and more.
- **Lazy streams:** chain `filter`, `map` and `sort`, then collect into any collection.
- **No `undefined` lookups:** `get`, `first`, `last` and `remove` return an `Optional`.
- **Functional helpers:** composable comparators, predicates, operators and `pipe`.
- **Async primitives:** `Mutex`, `Semaphore` and a lock-guarded `HashTable`.
- **Zero runtime dependencies,** with type declarations included.

> The library is pre-1.0, so the API can still change between minor versions.

## Installation

```sh
npm install easylib.ts
```

The package is compiled to ES2020 CommonJS and works from both `require` and `import`.

## Quick start

```ts
import { ArrayList, Collectors, Comparator } from "easylib.ts";

const users = ArrayList.of(
  { name: "Ada", age: 36 },
  { name: "Linus", age: 21 },
  { name: "Grace", age: 45 },
);

// Lookups return an Optional instead of undefined
console.log(users.get(9).map(u => u.name).orElse("nobody")); // nobody

// Every collection can be streamed
const names = users.iterator()
  .filter(u => u.age > 30)
  .map(u => u.name)
  .sort(Comparator.natural<string>())
  .collect(Collectors.ArrayList());

console.log(names.toArray()); // ["Ada", "Grace"]
```

## Optional

An `Optional<T>` is either a `Some` holding a value or a `None`. Collections return one wherever a value might be missing. Create one with `Some.of(value)`, `None.of()` or `Optional.ofNullable(value)`.

```ts
import { ArrayList, Optional } from "easylib.ts";

const port = Optional.ofNullable(undefined as string | undefined)
  .map(Number)
  .filter(p => p > 0)
  .orElse(3000);
console.log(port); // 3000

const list = ArrayList.of("a", "b");

// isSome() narrows the type and exposes .value
const first = list.first();
if (first.isSome()) console.log(first.value); // a

console.log(list.get(5).match({ some: v => v, none: () => "missing" })); // missing

list.first().ifSome(v => console.log(v)).finally(() => console.log("done"));
```

| Method | Purpose |
| --- | --- |
| `Optional.ofNullable(value)` | `None` for `null` or `undefined`, otherwise `Some` |
| `isSome()`, `isNone()` | Type-narrowing checks, also available as `isSome(opt)` and `isNone(opt)` |
| `map`, `flatMap`, `filter` | Transform the value when present |
| `or(other)`, `and(other)` | Combine two optionals |
| `orElse(value)`, `orGet(supplier)` | Unwrap with a fallback |
| `orThrow(error?)` | Unwrap or throw |
| `orErr(error)` | Convert to a `Result` |
| `match({ some, none })` | Handle both cases and return a value |
| `ifSome(fn).finally(fn)` | Run side effects |

An `Optional` is also iterable and yields zero or one values.

## Result

A `Result<T, E>` is either an `Ok` holding a value or an `Err` holding an `Error`. Create one with `Ok.of(value)`, `Err.of(error)` or `optional.orErr(error)`, or capture exceptions with `Result.ofThrowable(fn)` and `await Result.ofPromise(promise)`.

```ts
import { Result } from "easylib.ts";

const parse = (text: string) => Result.ofThrowable<number, SyntaxError>(() => JSON.parse(text));

console.log(parse("42").orThrow()); // 42

const result = parse("{");
console.log(result.isErr()); // true
console.log(result.map(n => n + 1).orElse(0)); // 0
console.log(result.mapError(() => new Error("invalid JSON")).match({ ok: String, err: e => e.message })); // invalid JSON

result
  .try(n => console.log(n))
  .catch(e => console.error(e.name))
  .finally(() => console.log("done"));
```

`Result` has the same `map`, `flatMap`, `filter`, `or`, `and`, `orElse`, `orGet`, `orThrow` and `match` methods as `Optional`, with two differences. `filter` takes the error to use when the predicate fails, and `orNone()` converts back to an `Optional`. It also adds `mapError` for transforming the error.

## Collections

| Class | Kind | Notes |
| --- | --- | --- |
| `ArrayList` | List, deque, stack | Array-backed, with `add`, `addFirst`, `remove`, `removeLast`, `first`, `last` |
| `SortedArrayList` | Sorted list | Stays sorted by a comparator, using binary search |
| `PriorityQueue` | Sorted queue | Binary heap. Iterating yields priority order without removing anything |
| `HashSet` | Set | Backed by the native `Set` |
| `CacheSet` | Set | A `HashSet` where re-adding an item moves it to the end |
| `TreeSet` | Sorted set | B-tree ordered by a comparator |

Every class has the same core API:

- `size`, `clear()`, `forEach()` and `toArray()`.
- `add(...items)` and `delete(...items)` return how many items actually changed.
- `has(...items)` is `true` only when every item is present, and `false` when called with no arguments.
- `map()` and `flatMap()` build a new collection eagerly.
- `iterator()` starts a stream, and `for...of` works directly.

Most classes offer `of(...items)` and `from(iterable)` factories, and sorted classes take the comparator first.

```ts
import { ArrayList, Comparator, HashSet, PriorityQueue, TreeSet } from "easylib.ts";

const list = new ArrayList([1, 2, 3]);
list.add(4);
console.log(list.remove().orThrow()); // 1
console.log(list.removeLast().orThrow()); // 4
console.log(list.toSorted(Comparator.reverse(Comparator.natural<number>())).toArray()); // [3, 2]

const a = HashSet.of(1, 2, 3);
const b = HashSet.of(2, 3, 4);
console.log(a.intersection(b).toArray()); // [2, 3]
console.log(a.difference(b).toArray()); // [1]

const queue = new PriorityQueue(Comparator.natural<number>(), [5, 1, 4]);
console.log(queue.remove().orThrow()); // 1

// head and tail split at a value. Lower bounds are inclusive, upper bounds exclusive
const tree = TreeSet.of(Comparator.natural<number>(), 5, 1, 3, 9);
console.log(tree.head(5).toArray()); // [1, 3]
console.log(tree.tail(5).toArray()); // [5, 9]
console.log(tree.slice(3, 9).toArray()); // [3, 5]
```

## Maps

| Class | Notes |
| --- | --- |
| `HashMap` | Backed by the native `Map` |
| `CacheMap` | A `HashMap` where setting a key moves it to the end. There is no capacity limit or eviction |
| `TreeMap` | B-tree ordered by a comparator, with `first`, `last`, `head`, `tail`, `slice` |
| `HashTable` | A `HashMap` behind a mutex, with an async API. See [Concurrency](#concurrency) |

`get` returns an `Optional`, and `keys()`, `values()` and `entries()` return streams.

```ts
import { CacheMap, Comparator, HashMap, TreeMap } from "easylib.ts";

const ages = new HashMap<string, number>().set("ada", 36).set("linus", 21);
console.log(ages.get("ada").orElse(0)); // 36
console.log(ages.get("bob").isNone()); // true
console.log(ages.keys().map(k => k.toUpperCase()).toArray()); // ["ADA", "LINUS"]

const recent = CacheMap.of(["a", 1], ["b", 2]);
recent.set("a", 3);
console.log(recent.keys().toArray()); // ["b", "a"]

const tree = TreeMap.of(Comparator.natural<number>(), [3, "c"], [1, "a"], [2, "b"]);
console.log(tree.first().orThrow()); // 1
console.log(tree.values().toArray()); // ["a", "b", "c"]
```

> Importing `Map` or `Set` from this package shadows the native globals in that file. They are abstract base classes, so you rarely need them outside type annotations.

## Streams

`StreamIterator` is a lazy pipeline over any iterable. Nothing runs until a terminal operation pulls values, so infinite sources are fine.

```ts
import { BinaryOperator, Collectors, StreamIterator, UnaryOperator } from "easylib.ts";

const squares = StreamIterator.iterate(1, UnaryOperator.increment())
  .map(n => n * n)
  .limit(5)
  .toArray();
console.log(squares); // [1, 4, 9, 16, 25]

console.log(StreamIterator.of(1, 2, 3).reduce(BinaryOperator.sum(), 0)); // 6

const lengths = StreamIterator.of("a", "bb")
  .map<[string, number]>(s => [s, s.length])
  .collect(Collectors.HashMap());
console.log(lengths.get("bb").orElse(0)); // 2

const groups = StreamIterator.of("apple", "avocado", "banana").groupby(w => w[0]);
console.log(groups.get("a").map(c => c.size).orElse(0)); // 2
```

A stream can be consumed only once, and a second use throws `Stream locked`. Call `buffer()` to get a stream you can read repeatedly.

```ts
import { StreamIterator } from "easylib.ts";

const buffered = StreamIterator.of(1, 2, 3).buffer();
console.log(buffered.count()); // 3
console.log(buffered.toArray()); // [1, 2, 3]
```

| Group | Methods |
| --- | --- |
| Sources | `of`, `from`, `fromObject`, `iterate`, `generate`, `concat`, `join` (zips iterables) |
| Slicing | `limit`, `drop`, `take(count, offset)`, `while`, `until`, `skip` (drops while the predicate holds) |
| Transforming | `map`, `flatMap`, `cacheMap`, `filter`, `peek`, `on` |
| Ordering and buffering | `sort`, `distinct`, `reverse`, `buffer` |
| Terminal | `forEach`, `reduce`, `collect`, `groupby`, `toArray`, `count`, `drain`, `find`, `findLast`, `some`, `every`, `min`, `max`, `tee`, `sink` |

Callbacks also receive the element index. `flatMap` expands only values that are a `StreamIterator`, so wrap arrays with `StreamIterator.from`. `find`, `findLast`, `min` and `max` return `T | undefined`, not an `Optional`.

`Collectors` has a factory for every collection and map, plus `Dictionary`. A collector is any function that takes an iterable, so `collect(ArrayList.from)` also works.

## Functional helpers

The function types `Functional`, `Predicate`, `Consumer`, `Supplier`, `Comparator`, `UnaryOperator` and `BinaryOperator` each have a namespace of ready-made helpers.

```ts
import { Comparator, Predicate, pipe, UnaryOperator } from "easylib.ts";

const slug = pipe(
  (s: string) => s.trim(),
  UnaryOperator.toLowerCase(),
  s => s.replace(/\s+/g, "-"),
);
console.log(slug("  Hello World ")); // hello-world
console.log(slug.iterate([" A ", "B c"]).toArray()); // ["a", "b-c"]

type User = { name: string; age: number };
const byAge = Comparator.byProperty<User, "age">("age", Comparator.natural<number>());
const oldestFirst = Comparator.reverse(byAge);
console.log(oldestFirst({ name: "a", age: 1 }, { name: "b", age: 2 })); // 1

const evenAndLarge = Predicate.every<number>(Predicate.isEven(), Predicate.isBetween(3, 9));
console.log([1, 2, 3, 4].filter(evenAndLarge)); // [4]
```

| Namespace | Helpers |
| --- | --- |
| `Functional` | `toString`, `equal`, `extract`, `compose`, `withDefault` |
| `Predicate` | `isTrue`, `isFalse`, `isNullish`, `not`, `isEven`, `every`, `some`, `isEmpty`, `isBetween` |
| `Consumer` | `log`, `combine` |
| `Supplier` | `of`, `sequence`, `memoize`, `randomInt` |
| `UnaryOperator` | `toLowerCase`, `toUpperCase`, `increment`, `trim`, `clamp` |
| `BinaryOperator` | `sum`, `sub`, `mul`, `div`, `mod`, `pow`, `max`, `min`, `concat` |
| `Comparator` | `natural`, `reverse`, `byProperty`, `thenComparing`, `nullsLast` |

`pipe` returns a callable `Pipeline` that also has `map`, `flatMap`, `bind`, `supply` and `iterate`.

## Dictionary

`Dictionary` is a string-keyed object whose properties read as `Some<T> | undefined`, so a present value and a missing key stay distinct.

```ts
import { Dictionary } from "easylib.ts";

const config = Dictionary.of({ host: "localhost" });
console.log(config.host?.value); // localhost
console.log(config.missing); // undefined
console.log("host" in config); // true
console.log([...config]); // [["host", "localhost"]]
```

## Concurrency

`Semaphore` hands out a limited number of locks over a shared resource. `Mutex` is a semaphore with a single lock.

```ts
import { Mutex, Semaphore } from "easylib.ts";

async function main() {
  const counter = new Mutex({ value: 0 });

  await Promise.all([1, 2, 3].map(async () => {
    const lock = await counter.acquire();
    try {
      lock.get().value++;
    } finally {
      lock.release();
    }
  }));

  await counter.run(c => { c.value *= 2; });

  const lock = counter.tryAcquire();
  console.log(lock?.get().value); // 6
  lock?.release();

  const pool = new Semaphore(() => "connection", 2);
  await pool.acquire();
  console.log(pool.count); // 1
}

main();
```

`run(fn)` holds a lock until `fn` finishes, including when `fn` is async, and returns its result. `acquire(ms)` rejects with `"timeout"` if no lock arrives in time. `tryAcquire()` returns `undefined` instead of waiting. `releaseAll()` and `rejectAll()` flush the wait queue and reset the semaphore, and `count`, `maxCount`, `waiters` and `locked` expose the current state.

`HashTable` runs every operation under a mutex, so its methods return promises. `open()` gives exclusive access through a synchronous map until you call `close()`.

```ts
import { HashTable } from "easylib.ts";

async function main() {
  const table = HashTable.of(["a", 1]);
  await table.add(["b", 2]);
  console.log((await table.get("b")).orElse(0)); // 2

  const map = await table.open();
  try {
    map.set("a", map.get("a").orElse(0) + 1);
    console.log(map.get("a").orThrow()); // 2
  } finally {
    map.close();
  }
}

main();
```

## Entry points

| Import | Contents |
| --- | --- |
| `easylib.ts` | The whole public API |
| `easylib.ts/collections` | Collection classes and interfaces |
| `easylib.ts/maps` | Map classes and `HashTable` |
| `easylib.ts/stream` | `StreamIterator`, `Collectors` |
| `easylib.ts/utils` | `Optional`, `Result`, `Dictionary`, functional helpers, concurrency |

## Development

```sh
git clone https://github.com/christianbraghette/lib.ts.git
cd lib.ts
npm install
npm test
```

`npm run build` compiles `src/` to `dist/`. `npm test` builds the library, then runs the suite in `tests/` with Node's built-in test runner. The tests import the package by name, so they exercise the same entry points that consumers use.

## License

[Mozilla Public License 2.0](LICENSE)
