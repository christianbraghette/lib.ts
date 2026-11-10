/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { FunctionalObject } from "./objects";
import { Throwable } from "./result";
import { StreamIterator } from "./stream";

/** A function of one argument. The `Functional` namespace holds ready-made helpers. */
export type Functional<T, R> = (args_0: T) => R;
/** A function of two arguments. */
export type BiFunctional<T, S, R> = (args_0: T, args_1: S) => R;
/** A function of three arguments. */
export type TriFunctional<T, S, U, R> = (args_0: T, args_1: S, args_2: U) => R;
/** A function of any number of arguments. */
export type GenericFunctional<T extends any[], R> = (...args: T) => R;
export namespace Functional {
    /** Creates a function that converts a value with `String`. */
    export function toString<T>(): Functional<T, string> {
        return (value: T) => String(value);
    }

    /** Creates a function that compares two values with `===`. */
    export function equal<T>(): BiFunctional<T, T, boolean> {
        return (a: T, b: T) => a === b;
    }

    /**
     * Creates a function that reads a property.
     * @param key The property to read.
     */
    export function extract<T, K extends keyof T>(key: K): Functional<T, T[K]> {
        return (obj: T) => obj[key];
    }

    /**
     * Creates a function that applies `f` and then `g`.
     * @param f Runs first.
     * @param g Receives the result of `f`.
     */
    export function compose<T, U, R>(f: Functional<T, U>, g: Functional<U, R>): Functional<T, R> {
        return (value: T) => g(f(value));
    }

    /**
     * Wraps a function so that a `null` or `undefined` result becomes a fallback.
     * @param fn The function to wrap.
     * @param fallback Returned in place of a nullish result.
     */
    export function withDefault<T, R>(fn: Functional<T, R | null | undefined>, fallback: R): Functional<T, R> {
        return (value: T) => {
            const result = fn(value);
            return result !== null && result !== undefined ? result : fallback;
        };
    }
}

/** A function that tests a value and returns a truthy or falsy result. The `Predicate` namespace holds ready-made helpers. */
export type Predicate<T> = Functional<T, unknown>;
/** A predicate of two arguments. */
export type BiPredicate<T, S> = BiFunctional<T, S, unknown>;
/** A predicate of three arguments. */
export type TriPredicate<T, S, U> = TriFunctional<T, S, U, unknown>;
export namespace Predicate {
    /** Creates a predicate that accepts exactly `true`. */
    export function isTrue(): Predicate<boolean> {
        return (value: boolean) => value === true;
    }

    /** Creates a predicate that accepts exactly `false`. */
    export function isFalse(): Predicate<boolean> {
        return (value: boolean) => value === false;
    }

    /** Creates a predicate that accepts `null` and `undefined`. */
    export function isNullish<T>(): Predicate<T | null | undefined> {
        return (value: T | null | undefined) => value === null || value === undefined;
    }

    /**
     * Inverts a predicate.
     * @param predicate The predicate to invert.
     */
    export function not<T>(predicate: Predicate<T>): Predicate<T> {
        return (value: T) => !predicate(value);
    }

    /** Creates a predicate that accepts even numbers. */
    export function isEven(): Predicate<number> {
        return (value: number) => value % 2 === 0;
    }

    /**
     * Creates a predicate that accepts values that all of the predicates accept.
     * @param predicates The predicates to combine.
     */
    export function every<T>(...predicates: Predicate<T>[]): Predicate<T> {
        return (value: T) => predicates.every(p => p(value));
    }

    /**
     * Creates a predicate that accepts values that at least one of the predicates accepts.
     * @param predicates The predicates to combine.
     */
    export function some<T>(...predicates: Predicate<T>[]): Predicate<T> {
        return (value: T) => predicates.some(p => p(value));
    }

    /** Creates a predicate that accepts strings and arrays of length 0. */
    export function isEmpty<T extends string | any[]>(): Predicate<T> {
        return (target: T) => target.length === 0;
    }

    /**
     * Creates a predicate that accepts numbers in a range.
     * @param min The inclusive lower bound.
     * @param max The inclusive upper bound.
     */
    export function isBetween(min: number, max: number): Predicate<number> {
        return (value: number) => value >= min && value <= max;
    }
}

/** A function that receives a value and returns nothing. The `Consumer` namespace holds ready-made helpers. */
export type Consumer<T> = Functional<T, void>;
/** A consumer of two arguments. */
export type BiConsumer<T, S> = BiFunctional<T, S, void>;
/** A consumer of three arguments. */
export type TriConsumer<T, S, U> = TriFunctional<T, S, U, void>;
export namespace Consumer {
    /**
     * Creates a consumer that writes values to `console.log`.
     * @param prefix Logged before each value.
     */
    export function log<T>(prefix?: string): Consumer<T> {
        return (value: T) => prefix ? console.log(prefix, value) : console.log(value);
    }

    /**
     * Creates a consumer that calls several consumers in order.
     * @param consumers The consumers to call.
     */
    export function combine<T>(...consumers: Consumer<T>[]): Consumer<T> {
        return (value: T) => consumers.forEach(consumer => consumer(value));
    }
}

/** A function that returns a value of the same type as its argument. The `UnaryOperator` namespace holds ready-made helpers. */
export type UnaryOperator<T> = Functional<T, T>;
export namespace UnaryOperator {
    /** Creates a function that lowercases a string. */
    export function toLowerCase(): Functional<string, string> {
        return (value: string) => value.toLowerCase();
    }

    /** Creates a function that uppercases a string. */
    export function toUpperCase(): Functional<string, string> {
        return (value: string) => value.toUpperCase();
    }

    /**
     * Creates a function that adds a fixed step to a number.
     * @param step The amount to add. Defaults to 1.
     */
    export function increment(step: number = 1): UnaryOperator<number> {
        return (value: number) => value + step;
    }

    /** Creates a function that trims a string. */
    export function trim(): UnaryOperator<string> {
        return (value: string) => value.trim();
    }

    /**
     * Creates a function that limits a number to a range.
     * @param min The lowest result.
     * @param max The highest result.
     */
    export function clamp(min: number, max: number): UnaryOperator<number> {
        return (value: number) => Math.max(min, Math.min(max, value));
    }
}

/** A function that combines two values of one type into a third. The `BinaryOperator` namespace holds ready-made helpers. */
export type BinaryOperator<T> = BiFunctional<T, T, T>;
export namespace BinaryOperator {
    /** Creates an addition function. */
    export function sum(): BinaryOperator<number> {
        return (a: number, b: number) => a + b;
    }

    /** Creates a subtraction function. */
    export function sub(): BinaryOperator<number> {
        return (a: number, b: number) => a - b;
    }

    /** Creates a multiplication function. */
    export function mul(): BinaryOperator<number> {
        return (a: number, b: number) => a * b;
    }

    /** Creates a division function. */
    export function div(): BinaryOperator<number> {
        return (a: number, b: number) => a / b;
    }

    /** Creates a remainder function. */
    export function mod(): BinaryOperator<number> {
        return (a: number, b: number) => a % b;
    }

    /** Creates an exponentiation function. */
    export function pow(): BinaryOperator<number> {
        return (a: number, b: number) => a ** b;
    }

    /**
     * Creates a function that returns the higher of two values.
     * @param comparator Defines the order.
     */
    export function max<T>(comparator: Comparator<T>): BinaryOperator<T> {
        return (a: T, b: T) => comparator(a, b) >= 0 ? a : b;
    }

    /**
     * Creates a function that returns the lower of two values.
     * @param comparator Defines the order.
     */
    export function min<T>(comparator: Comparator<T>): BinaryOperator<T> {
        return (a: T, b: T) => comparator(a, b) <= 0 ? a : b;
    }

    /**
     * Creates a function that joins two strings.
     * @param separator Placed between the strings. Defaults to an empty string.
     */
    export function concat(separator: string = ""): BinaryOperator<string> {
        return (a: string, b: string) => `${a}${separator}${b}`;
    }
}

/** A function with no arguments that produces a value. The `Supplier` namespace holds ready-made helpers. */
export type Supplier<R> = () => R;
export namespace Supplier {
    /**
     * Creates a supplier that always returns the same value.
     * @param value The value to return.
     */
    export function of<R>(value: R): Supplier<R> {
        return () => value;
    }

    /**
     * Creates a supplier that counts upwards by one.
     * @param start The first number. Defaults to 0.
     */
    export function sequence(start: number = 0): Supplier<number> {
        let current = start;
        return () => current++;
    }

    /**
     * Wraps a supplier so it runs only once and its result is reused.
     * @param factory The supplier to wrap.
     */
    export function memoize<R>(factory: Supplier<R>): Supplier<R> {
        let cache: R | undefined;
        let initialized = false;
        return () => {
            if (!initialized) {
                cache = factory();
                initialized = true;
            }
            return cache as R;
        };
    }

    /**
     * Creates a supplier of random integers.
     * @param min The inclusive lower bound.
     * @param max The inclusive upper bound.
     */
    export function randomInt(min: number, max: number): Supplier<number> {
        return () => Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

/** A function with no arguments and no result. */
export type Executor = Supplier<void>;

/** Orders two values: negative when `a` comes first, positive when `b` comes first, and 0 when they are equal. The `Comparator` namespace holds ready-made helpers. */
export type Comparator<T> = BiFunctional<T, T, number>;
export namespace Comparator {
    /**
     * Creates a comparator using the `<` and `>` operators.
     * @example
     * [2, 1, 3].sort(Comparator.natural<number>()); // [1, 2, 3]
     */
    export function natural<T extends string | number | any[]>(): Comparator<T> {
        return (a: T, b: T) => a < b ? -1 : a > b ? 1 : 0;
    }

    /**
     * Inverts a comparator.
     * @param comparator The comparator to invert.
     */
    export function reverse<T>(comparator: Comparator<T>): Comparator<T> {
        return (a: T, b: T) => comparator(a, b) * -1;
    }

    /**
     * Creates a comparator that orders objects by one property.
     * @param key The property to compare.
     * @param comparator Orders the property's values.
     * @example
     * const byAge = Comparator.byProperty<{ age: number }, "age">("age", Comparator.natural<number>());
     * byAge({ age: 1 }, { age: 2 }); // -1
     */
    export function byProperty<T, K extends keyof T>(key: K, comparator: Comparator<T[K]>): Comparator<T> {
        return (a: T, b: T) => comparator(a[key], b[key]);
    }

    /**
     * Creates a comparator that breaks ties in `first` using `second`.
     * @param first The primary order.
     * @param second Used when `first` returns 0.
     */
    export function thenComparing<T>(first: Comparator<T>, second: Comparator<T>): Comparator<T> {
        return (a: T, b: T) => {
            const result = first(a, b);
            return result !== 0 ? result : second(a, b);
        };
    }

    /**
     * Extends a comparator so `null` and `undefined` sort after every other value.
     * @param comparator Orders the non-nullish values.
     */
    export function nullsLast<T>(comparator: Comparator<T>): Comparator<T | null | undefined> {
        return (a, b) => {
            if (a === b) return 0;
            if (a === null || a === undefined) return 1;
            if (b === null || b === undefined) return -1;
            return comparator(a, b);
        };
    }
}

/** A class that takes arguments `T` and creates a `C`. */
export type Constructor<T extends any[], C> = new (...args: T) => C;

/** A function that never returns and always throws `E`. */
export type Thrower<E extends Error> = Supplier<Throwable<never, E>>;
export namespace Thrower {
    /**
     * Creates a function that always throws the given error.
     * @param error The error to throw.
     */
    export function error<E extends Error>(error: E): Supplier<Throwable<never, E>> {
        return () => { throw error; };
    }
}

export interface Pipeline<T, R> {
    /** Runs the value through every function in the pipeline. */
    (args_0: T): R;
}
/**
 * A callable chain of functions, usually created with `pipe`.
 * @example
 * const length = pipe((s: string) => s.trim(), s => s.length);
 * length(" ab "); // 2
 * length.map(n => n * 10)("ab"); // 20
 * length.iterate(["a", "bb"]).toArray(); // [1, 2]
 */
export class Pipeline<T, R> implements Functional<T, R>, FunctionalObject {

    /**
     * Creates a pipeline. Prefer `pipe`, which also infers the types.
     * @param funcs The functions to chain, from first to last.
     * @throws An error when no functions are given.
     */
    constructor(...funcs: Functional<any, any>[]) {
        if (funcs.length === 0)
            throw new Error("Empty Pipeline");

        // A fresh function, because the prototype and seal below must not touch the caller's functions.
        const source: Functional<any, any> = (value: any) => funcs.reduce((result, fn) => fn(result), value);

        Object.defineProperty(source, "name", { get: () => "Pipeline" });
        const obj = Object.assign(source as Functional<T, R>, this);
        Object.setPrototypeOf(obj, Pipeline.prototype);
        Object.seal(obj);
        return obj;
    }

    /**
     * Runs the pipeline on a value.
     * @param value The input.
     */
    public call(value: T): R {
        return this(value);
    }

    /**
     * Fixes the input and defers running the pipeline.
     * @param value The input.
     * @returns A supplier that runs the pipeline each time it is called.
     */
    public bind(value: T): Supplier<R> {
        return () => this(value);
    }

    /**
     * Runs the pipeline on a value produced by a supplier.
     * @param supplier Provides the input.
     */
    public apply(supplier: Supplier<T>): R {
        return this.call(supplier());
    }

    /**
     * Reads the input from a supplier now and defers running the pipeline.
     * @param supplier Provides the input and is called immediately.
     * @returns A supplier that runs the pipeline each time it is called.
     */
    public supply(supplier: Supplier<T>): Supplier<R> {
        return this.bind(supplier());
    }

    /**
     * Starts a lazy stream of this pipeline applied to each element of an iterable.
     * @param iterable The inputs.
     */
    public iterate(iterable: Iterable<T>): StreamIterator<R> {
        return StreamIterator.from(iterable).map(this);
    }

    /**
     * Creates a new pipeline with a function added to the end.
     * @param fn Receives this pipeline's result.
     */
    public map<S>(fn: Functional<R, S>): Pipeline<T, S> {
        return pipe((value: T) => this(value) as R, fn);
    }

    /**
     * Creates a new pipeline with a step that returns either a value or another pipeline.
     * @param fn Receives this pipeline's result. A returned Pipeline is run on that same result.
     */
    public flatMap<S>(fn: Functional<R, S | Pipeline<R, S>>): Pipeline<T, S> {
        return pipe((value: T) => this(value), (value: R) => {
            const res = fn(value);
            if (res instanceof Pipeline)
                return res.call(value);
            return res;
        });
    }

    /** Returns `"[object Pipeline]"`. */
    public toString(): string {
        return "[object Pipeline]";
    }

    get [Symbol.toStringTag](): string { return "Pipeline"; }
}

/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, O>(f1: Functional<A, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, O>(f1: Functional<A, B>, f2: Functional<B, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, C, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, C, D, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, C, D, E, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, C, D, E, F, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, C, D, E, F, G, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, C, D, E, F, G, H, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, C, D, E, F, G, H, I, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, I>, f9: Functional<I, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, C, D, E, F, G, H, I, J, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, I>, f9: Functional<I, J>, f10: Functional<J, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, C, D, E, F, G, H, I, J, K, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, I>, f9: Functional<I, J>, f10: Functional<J, K>, f11: Functional<K, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, I>, f9: Functional<I, J>, f10: Functional<J, K>, f11: Functional<K, L>, f12: Functional<L, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, I>, f9: Functional<I, J>, f10: Functional<J, K>, f11: Functional<K, L>, f12: Functional<L, M>, f13: Functional<M, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, I>, f9: Functional<I, J>, f10: Functional<J, K>, f11: Functional<K, L>, f12: Functional<L, M>, f13: Functional<M, N>, f14: Functional<N, O>): Pipeline<A, O>;
/** Composes functions from left to right into a callable Pipeline. */
export function pipe<T, R>(...funcs: Functional<any, any>[]): Pipeline<T, R> {
    return new Pipeline(...funcs);
}
