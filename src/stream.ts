/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Collection } from "./collections";
import { Dictionary } from "./dictionary";
import { BiConsumer, BiFunctional, BiPredicate, Comparator, Executor, Functional, Supplier, TriFunctional, UnaryOperator } from "./functional";
import { ArrayList, SortedArrayList } from "./list";
import { CacheMap, HashMap, TreeMap } from "./map";
import { AsyncIterableObject, FunctionalObject, registerStreamFactory } from "./objects";
import type { Optional, Some } from "./optional";
import { PriorityQueue } from "./queue";
import { CacheSet, HashSet, TreeSet } from "./set";


/** Turns the values of a stream into a result. `Collectors` has one for each collection. */
export type Collector<T, C> = Functional<Iterable<T>, C>;

/**
 * Factories for the functions accepted by `stream.collect`, one for each collection type.
 * @example
 * StreamIterator.of(2, 1, 2).collect(Collectors.HashSet()).toArray(); // [2, 1]
 * StreamIterator.of(2, 1).collect(Collectors.TreeSet(Comparator.natural<number>())).toArray(); // [1, 2]
 */
export class Collectors {
    /** Collects `[key, value]` pairs into a Dictionary. */
    public static Dictionary<T>(): (iterable: Iterable<[keyof any, T]>) => Dictionary<T> {
        return (iterable: Iterable<[keyof any, T]>) => new Dictionary(iterable);
    }

    /** Collects values into an ArrayList. */
    public static ArrayList<T>(): (iterable: Iterable<T>) => ArrayList<T> {
        return (iterable: Iterable<T>) => new ArrayList(iterable);
    }

    /**
     * Collects values into a SortedArrayList.
     * @param compareFn Defines the order.
     */
    public static SortedArrayList<T>(compareFn: Comparator<T>): (iterable: Iterable<T>) => SortedArrayList<T> {
        return (iterable: Iterable<T>) => new SortedArrayList(compareFn, iterable);
    }

    /** Collects values into a HashSet. */
    public static HashSet<T>(): (iterable: Iterable<T>) => HashSet<T> {
        return (iterable: Iterable<T>) => new HashSet(iterable);
    }

    /** Collects values into a CacheSet. */
    public static CacheSet<T>(): (iterable: Iterable<T>) => CacheSet<T> {
        return (iterable: Iterable<T>) => new CacheSet(iterable);
    }

    /**
     * Collects values into a TreeSet.
     * @param compareFn Defines the order.
     */
    public static TreeSet<T>(compareFn: Comparator<T>): (iterable: Iterable<T>) => TreeSet<T> {
        return (iterable: Iterable<T>) => new TreeSet(compareFn, iterable);
    }

    /**
     * Collects values into a PriorityQueue.
     * @param compareFn Defines the priority.
     */
    public static PriorityQueue<T>(compareFn: Comparator<T>): (iterable: Iterable<T>) => PriorityQueue<T> {
        return (iterable: Iterable<T>) => new PriorityQueue(compareFn, iterable);
    }

    /** Collects `[key, value]` pairs into a HashMap. */
    public static HashMap<K, V>(): (iterable: Iterable<[K, V]>) => HashMap<K, V> {
        return (iterable: Iterable<[K, V]>) => new HashMap(iterable);
    }

    /** Collects `[key, value]` pairs into a CacheMap. */
    public static CacheMap<K, V>(): (iterable: Iterable<[K, V]>) => CacheMap<K, V> {
        return (iterable: Iterable<[K, V]>) => new CacheMap(iterable);
    }

    /**
     * Collects `[key, value]` pairs into a TreeMap.
     * @param compareFn Defines the key order.
     */
    public static TreeMap<K, V>(compareFn: Comparator<K>): (iterable: Iterable<[K, V]>) => TreeMap<K, V> {
        return (iterable: Iterable<[K, V]>) => new TreeMap(compareFn, iterable);
    }
}

/** The result of `stream.groupby`. */
interface GroupByAccessor<K, V> {
    /**
     * Reads the group for a key.
     * @param key The group's key.
     * @returns The group's values, or None when no value had this key.
     */
    get(key: K): Optional<Collection<V>>;
}

class StreamLockedError extends Error {
    constructor() {
        super("Stream locked");
    }
}

/**
 * Wraps an iterable so it can be read repeatedly. Values are pulled from the source once, on
 * demand, so partial and interleaved reads all see the same sequence.
 */
function replay<T>(source: Iterable<T>): Supplier<Iterable<T>> {
    const buffer: T[] = [];
    let iterator: Iterator<T> | undefined;
    let done = false;

    return function* () {
        for (let i = 0; ; i++) {
            if (i < buffer.length) {
                yield buffer[i];
                continue;
            }
            if (done) return;

            iterator ??= source[Symbol.iterator]();
            const next = iterator.next();
            if (next.done) {
                done = true;
                return;
            }
            buffer.push(next.value);
            yield next.value;
        }
    };
}

/** The operations shared by every stream. */
class StreamConstructor<T> extends AsyncIterableObject<T> implements FunctionalObject {
    #source: Supplier<Iterable<T>>;
    #locked = false;
    #reusable: boolean;

    constructor(supplier: Supplier<Iterable<T>>, reusable: boolean) {
        super()
        this.#source = supplier;
        this.#reusable = !!reusable;
    }

    #lock(): Iterable<T> {
        if (this.#locked)
            throw new StreamLockedError();
        if (!this.#reusable)
            this.#locked = true;
        return this.#source();
    }

    /** `true` once a single-use stream has been consumed. */
    public get locked(): boolean {
        return this.#locked;
    }

    /**
     * Keeps a window of values.
     * @param count How many values to keep.
     * @param offset How many values to skip first. Defaults to 0.
     */
    public take(count: number, offset: number = 0): StreamIterator<T> {
        const source = this.#lock();
        return new StreamIterator(
            function* () {
                if (count <= 0) return;
                let i = 0;
                for (const val of source) {
                    if (i >= offset)
                        yield val;
                    // Stop right after the last value, so the source is not pulled once more.
                    if (++i >= count + offset) break;
                }
            }
        );
    }

    /**
     * Skips the first values.
     * @param offset How many values to skip.
     */
    public drop(offset: number): StreamIterator<T> {
        const source = this.#lock();
        return new StreamIterator(
            function* () {
                let i = 0;
                for (const val of source) {
                    if (i >= offset)
                        yield val;
                    i++;
                }
            }
        );
    }

    /**
     * Keeps at most the first values. Use this to end an infinite stream.
     * @param count How many values to keep.
     */
    public limit(count: number): StreamIterator<T> {
        return this.take(count);
    }

    /**
     * Keeps values until the predicate first rejects one.
     * @param predicate Receives the value and its index.
     */
    public while(predicate: BiPredicate<T, number>): StreamIterator<T> {
        const source = this.#lock();
        return new StreamIterator(function* () {
            let i = 0;
            for (const value of source) {
                if (!predicate(value, i++)) break;
                yield value;
            }
        });
    }

    /**
     * Drops values until the predicate first rejects one, then keeps the rest.
     * @param predicate Receives the value and its index.
     */
    public skip(predicate: BiPredicate<T, number>): StreamIterator<T> {
        const source = this.#lock();
        return new StreamIterator(function* () {
            let i = 0;
            let dropping = true;
            for (const value of source) {
                if (dropping && predicate(value, i++)) continue;
                dropping = false;
                yield value;
            }
        });
    }

    /**
     * Keeps values until the predicate first accepts one, which is excluded.
     * @param predicate Receives the value and its index.
     */
    public until(predicate: BiPredicate<T, number>): StreamIterator<T> {
        const source = this.#lock();
        return new StreamIterator(
            function* () {
                let i = 0;
                for (const val of source) {
                    if (predicate(val, i++)) break;
                    yield val;
                }
            }
        );
    }

    /**
     * Transforms each value.
     * @param callbackfn Receives the value and its index.
     */
    public map<U>(callbackfn: BiFunctional<T, number, U>): StreamIterator<U> {
        const source = this.#lock();
        return new StreamIterator(
            function* (): IterableIterator<U> {
                let i = 0;
                for (const value of source)
                    yield callbackfn(value, i++);
            }
        );
    }

    /**
     * Transforms each value with access to a state object shared across the whole stream.
     * @param callbackfn Receives the state, the value and its index.
     * @param cache The shared state.
     */
    public cacheMap<U, R>(callbackfn: TriFunctional<U, T, number, R>, cache: U): StreamIterator<R> {
        let i = 0;
        const source = this.#lock();
        return new StreamIterator(function* () {
            for (const value of source) {
                yield callbackfn(cache, value, i++);
            }
        })
    }

    /**
     * Transforms each value and expands any returned StreamIterator. Wrap arrays with `StreamIterator.from`.
     * @param callbackfn Receives the value and its index.
     */
    public flatMap<U>(callbackfn: BiFunctional<T, number, U | StreamIterator<U>>): StreamIterator<U> {
        const source = this.#lock();
        return new StreamIterator(function* () {
            let i = 0
            for (const value of source) {
                const mapped = callbackfn(value, i++);
                if (mapped instanceof StreamIterator) {
                    yield* mapped;
                } else {
                    yield mapped;
                }
            }
        });
    }

    /**
     * Keeps the values a predicate accepts.
     * @param predicate Receives the value and its index.
     */
    public filter<S extends T>(predicate: BiPredicate<T, number>): StreamIterator<S> {
        const source = this.#lock();
        return new StreamIterator(
            function* () {
                let i = 0;
                for (const value of source) {
                    if (predicate(value, i++)) {
                        yield value as S;
                    }
                }
            }
        );
    }

    /**
     * Observes each value as it passes through, without changing it.
     * @param callbackfn Receives the value and its index.
     */
    public peek(callbackfn: BiConsumer<T, number>): StreamIterator<T> {
        const source = this.#lock();
        return new StreamIterator(function* () {
            let i = 0;
            for (const value of source) {
                callbackfn(value, i++);
                yield value;
            }
        });
    }

    /**
     * Attaches lifecycle hooks to the stream.
     * @param opts `call` runs before the first value, `peek` runs for each value, and `return` runs after the last value if the stream is read to the end.
     */
    public on(opts: {
        call?: Executor,
        peek?: BiConsumer<T, number>,
        return?: Executor
    }): StreamIterator<T> {
        const source = this.#lock();
        return new StreamIterator(function* () {
            opts.call?.();
            if (opts.peek) {
                let i = 0;
                for (const value of source) {
                    opts.peek(value, i++);
                    yield value;
                }
            } else {
                yield* source;
            }
            opts.return?.();
        });
    }

    /**
     * Sorts the values. The sort is stable, and the whole source is read at the first pull.
     * @param compareFn Defines the order.
     */
    public sort(compareFn: Comparator<T>): StreamIterator<T> {
        const source = this.#lock();
        return new StreamIterator(function* () {
            yield* Array.from(source).sort(compareFn);
        })
    }

    /**
     * Reverses the values. The whole source is read at the first pull.
     * @returns A stream that can be read repeatedly.
     */
    public reverse(): BufferedStream<T> {
        const source = this.#lock();
        let reversed: T[] | undefined;
        return new BufferedStream(function* () {
            yield* (reversed ??= Array.from(source).reverse());
        });
    }

    /**
     * Removes repeated values, comparing them as a native `Set` does.
     * @returns A stream that can be read repeatedly.
     */
    public distinct(): BufferedStream<T> {
        const source = this.#lock();
        return new BufferedStream(replay(function* () {
            const seen = new Set<T>();
            for (const value of source) {
                if (seen.has(value)) continue;
                seen.add(value);
                yield value;
            }
        }()));
    }

    /**
     * Makes a stream that can be read repeatedly. Values are pulled from the source once, on demand, and replayed.
     * @example
     * const buffered = StreamIterator.of(1, 2).buffer();
     * buffered.count(); // 2
     * buffered.toArray(); // [1, 2]
     */
    public buffer(): BufferedStream<T> {
        return new BufferedStream(replay(this.#lock()));
    }

    /** Continues this stream as a new StreamIterator. */
    public iterator(): StreamIterator<T> {
        const source = this.#lock();
        return new StreamIterator(() => source);
    }

    // Terminators

    /**
     * Calls a function for each value. This is a terminal operation.
     * @param callbackfn Receives the value and its index.
     */
    public forEach(callbackfn: BiConsumer<T, number>): void {
        let i = 0;
        for (const value of this.#lock())
            callbackfn(value, i++);
    }

    /**
     * Combines the values into one result. This is a terminal operation.
     * @param callbackfn Receives the accumulated result, the value and its index.
     * @param initialValue The starting result.
     */
    public reduce<U>(callbackfn: TriFunctional<U, T, number, U>, initialValue: U): U {
        let i = 0;
        let accumulator = initialValue;
        for (const value of this.#lock()) {
            accumulator = callbackfn(accumulator, value, i++);
        }
        return accumulator;
    }

    /**
     * Finds the first value a predicate accepts. This is a terminal operation.
     * @param predicate Receives the value and its index.
     * @returns The value, or `undefined` when none matches.
     */
    public find<S extends T>(predicate: BiPredicate<T, number>): S | undefined {
        let i = 0;
        for (const value of this.#lock()) {
            if (predicate(value, i++)) {
                return value as S;
            }
        }
        return undefined;
    }

    /**
     * Finds the last value a predicate accepts. This is a terminal operation.
     * @param predicate Receives the value and its index.
     * @returns The value, or `undefined` when none matches.
     */
    public findLast<S extends T>(predicate: BiPredicate<T, number>): S | undefined {
        let i = 0;
        let target: S | undefined = undefined;
        for (const value of this.#lock())
            if (predicate(value, i++))
                target = value as S;
        return target;
    }

    /**
     * Checks whether a predicate accepts at least one value. This is a terminal operation.
     * @param predicate Receives the value and its index.
     */
    public some(predicate: BiPredicate<T, number>): boolean {
        let i = 0;
        for (const value of this.#lock()) {
            if (predicate(value, i++)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Checks whether a predicate accepts every value. This is a terminal operation.
     * @param predicate Receives the value and its index.
     */
    public every(predicate: BiPredicate<T, number>): boolean {
        let i = 0;
        for (const value of this.#lock()) {
            if (!predicate(value, i++)) {
                return false;
            }
        }
        return true;
    }

    /** Counts the values. This is a terminal operation. */
    public count(): number {
        let count = 0;
        for (const _ of this.#lock())
            count++;
        return count;
    }

    /**
     * Finds the lowest value. This is a terminal operation.
     * @param compareFn Defines the order.
     * @returns The value, or `undefined` when the stream is empty.
     */
    public min(compareFn: Comparator<T>): T | undefined {
        let min: T | undefined = undefined;
        for (const value of this.#lock()) {
            min ??= value;
            if (compareFn(value, min) < 0) min = value;
        }
        return min;
    }

    /**
     * Finds the highest value. This is a terminal operation.
     * @param compareFn Defines the order.
     * @returns The value, or `undefined` when the stream is empty.
     */
    public max(compareFn: Comparator<T>): T | undefined {
        let max: T | undefined = undefined;
        for (const value of this.#lock()) {
            max ??= value;
            if (compareFn(max, value) < 0) max = value;
        }
        return max;
    }

    /**
     * Groups the values by a key. This is a terminal operation.
     * @param keyFn Receives the value and its index and returns its group's key.
     * @returns An object whose `get` returns a group as an Optional.
     * @example
     * const groups = StreamIterator.of("apple", "avocado", "kiwi").groupby(word => word[0]);
     * groups.get("a").map(group => group.size).orElse(0); // 2
     */
    public groupby<K>(keyFn: BiFunctional<T, number, K>): GroupByAccessor<K, T> {
        const cache = new HashMap<K, ArrayList<T>>();
        let i = 0;
        for (const value of this.#lock()) {
            const key = keyFn(value, i++);
            if (!cache.has(key))
                cache.set(key, new ArrayList());
            (cache.get(key) as Some<ArrayList<T>>).value.add(value);
        }
        return cache as any;
    }

    /**
     * Passes the values to a collector. This is a terminal operation.
     * @param collector A function that takes an iterable, usually from `Collectors`.
     * @returns The collector's result.
     */
    public collect<C>(collector: Collector<T, C>): C {
        return collector(this.#lock());
    }

    /**
     * Lets several functions read the same values through a shared buffer.
     * @param funcs Each receives the buffered stream and may return a derived stream.
     * @returns The streams the functions returned, in order. Functions that return nothing are left out.
     */
    public tee(...funcs: Functional<BufferedStream<T>, StreamIterator<T> | BufferedStream<T> | void>[]): ArrayList<StreamIterator<T>> {
        const buffer = this.buffer();
        return new StreamIterator(() => funcs.values()).map(fn => fn(buffer)?.iterator()).filter<StreamIterator<T>>(val => !!val).collect(ArrayList.from);
    }

    /** Consumes the stream as a plain iterator. */
    public *sink(): IterableIterator<T> {
        yield* this.#lock();
    }

    /** Reads every value and discards it, which is useful to trigger side effects. This is a terminal operation. */
    public drain(): void {
        for (const _ of this.#lock());
    }

    /** Collects the values into an array. This is a terminal operation. */
    public toArray() {
        return Array.from(this);
    }

    /** Joins the values with commas. This is a terminal operation. */
    public toString(): string {
        return this.toArray().toString();
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this.sink();
    }

    async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
        yield* this.sink()
    }

    get [Symbol.toStringTag](): string { return "Stream"; }

    /**
     * Zips iterables into a stream of tuples, ending with the shortest iterable.
     * @param iterables The iterables to zip.
     */
    public static join<S>(...iterables: Iterable<S>[]): StreamIterator<S[]> {
        const iterators = iterables.map(val => val[Symbol.iterator]()) as Iterator<S>[];

        return new StreamIterator(
            function* () {
                while (true) {
                    var res = iterators.map(val => val.next());
                    if (res.some(val => val.done)) break;
                    yield res.map(val => val.value) as S[];
                };
            }
        );
    }

    /**
     * Creates an infinite stream of supplied values. End it with `limit` or `while`.
     * @param supplier Called for each value.
     */
    public static generate<S>(supplier: Supplier<S>): StreamIterator<S> {
        return new StreamIterator(function* () {
            while (true) {
                yield supplier();
            }
        });
    }

    /**
     * Creates an infinite stream by applying a function repeatedly. End it with `limit` or `while`.
     * @param startValue The first value.
     * @param fn Produces each next value from the previous one.
     */
    public static iterate<S>(startValue: S, fn: UnaryOperator<S>): StreamIterator<S> {
        return new StreamIterator(function* () {
            let currentValue = startValue;
            yield currentValue;
            while (true) {
                currentValue = fn(currentValue);
                yield currentValue;
            }
        });
    }

    /**
     * Creates a stream that reads several iterables one after another.
     * @param iterables The iterables to read.
     */
    public static concat<S>(...iterables: Iterable<S>[]): StreamIterator<S> {
        return new StreamIterator(function* () {
            for (const iterable of iterables)
                yield* iterable;
        });
    }

    /**
     * Creates a stream of its arguments.
     * @param items The values.
     */
    public static of<S>(...items: S[]): StreamIterator<S> {
        return new StreamIterator(() => items);
    }

    /**
     * Creates a stream over an iterable.
     * @param iterable The source.
     */
    public static from<S>(iterable: Iterable<S>): StreamIterator<S> {
        return new StreamIterator(() => iterable);
    }

    /**
     * Creates a stream of an object's `[key, value]` pairs.
     * @param obj The source object.
     */
    public static fromObject<S>(obj: Record<string | number, S>): StreamIterator<[string, S]> {
        return new StreamIterator(() => Object.entries(obj));
    }
}

/**
 * A lazy, single-use pipeline over any iterable. Nothing runs until a terminal operation such as `toArray` pulls values, so infinite sources are fine. Using a stream twice throws "Stream locked". Call `buffer()` to get a stream that can be read repeatedly.
 * @example
 * StreamIterator.iterate(1, UnaryOperator.increment()).map(n => n * n).limit(3).toArray(); // [1, 4, 9]
 * StreamIterator.of(1, 2, 3).filter(n => n > 1).reduce(BinaryOperator.sum(), 0); // 5
 * ArrayList.of(1, 2).iterator().map(n => n + 1).toArray(); // [2, 3]
 */
export class StreamIterator<T> extends StreamConstructor<T> {
    /**
     * Creates a stream. Prefer the factories `of`, `from` and `iterate`.
     * @param supplier Provides the source iterable.
     */
    constructor(supplier: Supplier<Iterable<T>>) {
        super(supplier, false)
    }
}

/** A stream that can be read repeatedly. Values are pulled from its source once and replayed. */
class BufferedStream<T> extends StreamConstructor<T> {
    /**
     * Creates a repeatable stream.
     * @param supplier Provides a fresh iterable for each read.
     */
    constructor(supplier: Supplier<Iterable<T>>) {
        super(supplier, true);
    }

    /** Starts a new single-use stream over the buffered values. */
    public override iterator(): StreamIterator<T> {
        return new StreamIterator(() => this.sink())
    }
}

registerStreamFactory(source => new StreamIterator(source));