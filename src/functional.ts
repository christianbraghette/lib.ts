import { FunctionalObject, IterableObject } from "./objects";
import { Throwable } from "./result";
import { Stream } from "./stream";

export type Functional<T, R> = (args_0: T) => R;
export type BiFunctional<T, S, R> = (args_0: T, args_1: S) => R;
export type TriFunctional<T, S, U, R> = (args_0: T, args_1: S, args_2: U) => R;
export type GenericFunctional<T extends any[], R> = (...args: T) => R;
export namespace Functional {
    export function toString<T>(): Functional<T, string> {
        return (value: T) => String(value);
    }

    export function equal<T>(): BiFunctional<T, T, boolean> {
        return (a: T, b: T) => a === b;
    }

    export function extract<T, K extends keyof T>(key: K): Functional<T, T[K]> {
        return (obj: T) => obj[key];
    }

    export function compose<T, U, R>(f: Functional<T, U>, g: Functional<U, R>): Functional<T, R> {
        return (value: T) => g(f(value));
    }

    export function withDefault<T, R>(fn: Functional<T, R | null | undefined>, fallback: R): Functional<T, R> {
        return (value: T) => {
            const result = fn(value);
            return result !== null && result !== undefined ? result : fallback;
        };
    }
}

export type Predicate<T> = Functional<T, unknown>;
export type BiPredicate<T, S> = BiFunctional<T, S, unknown>;
export type TriPredicate<T, S, U> = TriFunctional<T, S, U, unknown>;
export namespace Predicate {
    export function isTrue(): Predicate<boolean> {
        return (value: boolean) => value === true;
    }

    export function isFalse(): Predicate<boolean> {
        return (value: boolean) => value === true;
    }

    export function isNullish<T>(): Predicate<T | null | undefined> {
        return (value: T | null | undefined) => value === null || value === undefined;
    }

    export function not<T>(predicate: Predicate<T>): Predicate<T> {
        return (value: T) => !predicate(value);
    }

    export function isEven(): Predicate<number> {
        return (value: number) => value % 2 === 0;
    }

    export function every<T>(...predicates: Predicate<T>[]): Predicate<T> {
        return (value: T) => predicates.every(p => p(value));
    }

    export function some<T>(...predicates: Predicate<T>[]): Predicate<T> {
        return (value: T) => predicates.some(p => p(value));
    }

    export function isEmpty<T extends string | any[]>(): Predicate<T> {
        return (target: T) => target.length === 0;
    }

    export function isBetween(min: number, max: number): Predicate<number> {
        return (value: number) => value >= min && value <= max;
    }
}

export type Consumer<T> = Functional<T, void>;
export type BiConsumer<T, S> = BiFunctional<T, S, void>;
export type TriConsumer<T, S, U> = TriFunctional<T, S, U, void>;
export namespace Consumer {
    export function log<T>(prefix?: string): Consumer<T> {
        return (value: T) => prefix ? console.log(prefix, value) : console.log(value);
    }

    export function combine<T>(...consumers: Consumer<T>[]): Consumer<T> {
        return (value: T) => consumers.forEach(consumer => consumer(value));
    }
}

export type UnaryOperator<T> = Functional<T, T>;
export namespace UnaryOperator {
    export function toLowerCase(): Functional<string, string> {
        return (value: string) => value.toLowerCase();
    }

    export function toUpperCase(): Functional<string, string> {
        return (value: string) => value.toUpperCase();
    }

    export function increment(step: number = 1): UnaryOperator<number> {
        return (value: number) => value + step;
    }

    export function trim(): UnaryOperator<string> {
        return (value: string) => value.trim();
    }

    export function clamp(min: number, max: number): UnaryOperator<number> {
        return (value: number) => Math.max(min, Math.min(max, value));
    }
}

export type BinaryOperator<T> = BiFunctional<T, T, T>;
export namespace BinaryOperator {
    export function sum(): BinaryOperator<number> {
        return (a: number, b: number) => a + b;
    }

    export function sub(): BinaryOperator<number> {
        return (a: number, b: number) => a - b;
    }

    export function mul(): BinaryOperator<number> {
        return (a: number, b: number) => a * b;
    }

    export function div(): BinaryOperator<number> {
        return (a: number, b: number) => a / b;
    }

    export function mod(): BinaryOperator<number> {
        return (a: number, b: number) => a % b;
    }

    export function pow(): BinaryOperator<number> {
        return (a: number, b: number) => a ** b;
    }

    export function max<T>(comparator: Comparator<T>): BinaryOperator<T> {
        return (a: T, b: T) => comparator(a, b) >= 0 ? a : b;
    }

    export function min<T>(comparator: Comparator<T>): BinaryOperator<T> {
        return (a: T, b: T) => comparator(a, b) <= 0 ? a : b;
    }

    export function concat(separator: string = ""): BinaryOperator<string> {
        return (a: string, b: string) => `${a}${separator}${b}`;
    }
}

export type Supplier<R> = () => R;
export namespace Supplier {
    export function of<R>(value: R): Supplier<R> {
        return () => value;
    }

    export function sequence(start: number = 0): Supplier<number> {
        let current = start;
        return () => current++;
    }

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

    export function randomInt(min: number, max: number): Supplier<number> {
        return () => Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

export type Executor = Supplier<void>;

export type Comparator<T> = BiFunctional<T, T, number>;
export namespace Comparator {
    export function natural<T extends string | number | any[]>(): Comparator<T> {
        return (a: T, b: T) => a < b ? -1 : a > b ? 1 : 0;
    }

    export function reverse<T>(comparator: Comparator<T>): Comparator<T> {
        return (a: T, b: T) => comparator(a, b) * -1;
    }

    export function byProperty<T, K extends keyof T>(key: K, comparator: Comparator<T[K]>): Comparator<T> {
        return (a: T, b: T) => comparator(a[key], b[key]);
    }

    export function thenComparing<T>(first: Comparator<T>, second: Comparator<T>): Comparator<T> {
        return (a: T, b: T) => {
            const result = first(a, b);
            return result !== 0 ? result : second(a, b);
        };
    }

    export function nullsLast<T>(comparator: Comparator<T>): Comparator<T | null | undefined> {
        return (a, b) => {
            if (a === b) return 0;
            if (a === null || a === undefined) return 1;
            if (b === null || b === undefined) return -1;
            return comparator(a, b);
        };
    }
}

export type Constructor<T extends any[], C> = new (...args: T) => C;

export type Thrower<E extends Error> = Supplier<Throwable<never, E>>;
export namespace Thrower {
    export function error<E extends Error>(error: E): Supplier<Throwable<never, E>> {
        return () => { throw error; };
    }
}

export interface Pipeline<T, R> {
    (args_0: T): R;
}
export class Pipeline<T, R> extends IterableObject<Functional<T, R>> implements Functional<T, R>, FunctionalObject {

    constructor(...funcs: Functional<any, any>[]) {
        super();
        let source: Functional<any, any> | undefined = undefined;
        for (const functional of funcs)
            if (!source)
                source = functional;
            else
                source = Functional.compose(source, functional);
        if (!source)
            throw new Error("Empty Pipeline");

        Object.defineProperty(source, "name", { get: () => "Pipeline" });
        const obj = Object.assign(source as Functional<T, R>, this);
        Object.setPrototypeOf(obj, Pipeline.prototype);
        Object.seal(obj);
        return obj;
    }

    public call(value: T): R {
        return this(value);
    }

    public bind(value: T): Supplier<R> {
        return () => this(value);
    }

    public apply(supplier: Supplier<T>): R {
        return this.call(supplier());
    }

    public supply(supplier: Supplier<T>): Supplier<R> {
        return this.bind(supplier());
    }

    public iterate(iterable: Iterable<T>): Stream<R> {
        return Stream.from(iterable).map(this);
    }

    public map<S>(fn: Functional<R, S>): Pipeline<T, S> {
        return pipe((value: T) => this(value) as R, fn);
    }

    public flatMap<S>(fn: Functional<R, S | Pipeline<R, S>>): Pipeline<T, S> {
        return pipe((value: T) => this(value), (value: R) => {
            const res = fn(value);
            if (res instanceof Pipeline)
                return res.call(value);
            return res;
        });
    }

    public toString(): string {
        return "[object Pipeline]";
    }

    public *[Symbol.iterator](): IterableIterator<Pipeline<T, R>> {
        yield this;
    }
}

export function pipe<A, O>(f1: Functional<A, O>): Pipeline<A, O>;
export function pipe<A, B, O>(f1: Functional<A, B>, f2: Functional<B, O>): Pipeline<A, O>;
export function pipe<A, B, C, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, O>): Pipeline<A, O>;
export function pipe<A, B, C, D, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, O>): Pipeline<A, O>;
export function pipe<A, B, C, D, E, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, O>): Pipeline<A, O>;
export function pipe<A, B, C, D, E, F, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, O>): Pipeline<A, O>;
export function pipe<A, B, C, D, E, F, G, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, O>): Pipeline<A, O>;
export function pipe<A, B, C, D, E, F, G, H, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, O>): Pipeline<A, O>;
export function pipe<A, B, C, D, E, F, G, H, I, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, I>, f9: Functional<I, O>): Pipeline<A, O>;
export function pipe<A, B, C, D, E, F, G, H, I, J, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, I>, f9: Functional<I, J>, f10: Functional<J, O>): Pipeline<A, O>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, I>, f9: Functional<I, J>, f10: Functional<J, K>, f11: Functional<K, O>): Pipeline<A, O>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, I>, f9: Functional<I, J>, f10: Functional<J, K>, f11: Functional<K, L>, f12: Functional<L, O>): Pipeline<A, O>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, I>, f9: Functional<I, J>, f10: Functional<J, K>, f11: Functional<K, L>, f12: Functional<L, M>, f13: Functional<M, O>): Pipeline<A, O>;
export function pipe<A, B, C, D, E, F, G, H, I, J, K, L, M, N, O>(f1: Functional<A, B>, f2: Functional<B, C>, f3: Functional<C, D>, f4: Functional<D, E>, f5: Functional<E, F>, f6: Functional<F, G>, f7: Functional<G, H>, f8: Functional<H, I>, f9: Functional<I, J>, f10: Functional<J, K>, f11: Functional<K, L>, f12: Functional<L, M>, f13: Functional<M, N>, f14: Functional<N, O>): Pipeline<A, O>;
export function pipe<T, R>(...funcs: Functional<any, any>[]): Pipeline<T, R> {
    return new Pipeline(...funcs);
}
