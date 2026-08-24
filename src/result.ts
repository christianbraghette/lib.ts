import { Consumer, Executor, Predicate, Supplier, Functional } from "./functional";
import { FunctionalObject, IterableObject } from "./objects";

export type Throwable<T, E extends Error = Error> = T & { readonly __error?: E };
export type Try<T> = T extends Throwable<infer U> ? U : T;
export type Catch<T> = T extends Throwable<any, infer E> ? E : never;

export interface ResultMatcher<T, E extends Error, R> {
    ok: (value: T) => R;
    err: (error: E) => R;
}

class Finalizer {
    public finally(executor: Executor): void {
        executor();
    }
}

class Catcher<E extends Error> extends Finalizer {
    readonly #error?: E;

    constructor(error?: E) {
        super();
        this.#error = error;
    }

    public catch(catcher: Consumer<E>): Finalizer {
        if (this.#error) {
            catcher(this.#error);
        }
        return new Finalizer();
    }
}

export function isOk<T, E extends Error>(result: Result<T, E>): result is Ok<T> {
    return result.isOk();
}

export function isErr<T, E extends Error>(result: Result<T, E>): result is Err<E> {
    return result.isErr();
}

export abstract class Result<T, E extends Error> extends IterableObject<T> implements FunctionalObject {
    public abstract isOk(): this is Ok<T>;
    public abstract isErr(): this is Err<E>;

    public abstract orThrow(): T;
    public abstract orGet(supplier: Supplier<T>): T;

    public abstract match<R>(matcher: ResultMatcher<T, E, R>): R;
    public abstract try(consumer: Consumer<T>): Catcher<E>;

    public abstract or(other: Result<T, E>): Result<T, E>;
    public abstract and<S>(other: Result<S, E>): Result<S, E>;
    public abstract filter<M extends Error>(predicate: Predicate<T>, error: M): Result<T, E | M>;
    public abstract map<S>(fn: Functional<T, S>): Result<S, E>;
    public abstract flatMap<S>(fn: Functional<T, Result<S, E>>): Result<S, E>;

    public pipe(): Supplier<this> {
        return () => this;
    }

    public static ok<T>(value: T): Ok<T> {
        return new Ok(value);
    }

    public static err<E extends Error>(error: E): Err<E> {
        return new Err(error);
    }

    public static try<T extends Throwable<any, any>>(thrower: Supplier<T>): Result<Try<T>, Catch<T>> {
        try {
            return new Ok<Try<T>>(thrower() as Try<T>);
        } catch (e: any) {
            return new Err<Catch<T>>(e as Catch<T>);
        }
    }
}

export class Ok<T> extends Result<T, never> {
    readonly #value: T;

    public constructor(value: T) {
        super();
        this.#value = value;
    }

    public get value(): T {
        return this.#value;
    }

    public override isOk(): this is Ok<T> {
        return true;
    }

    public override isErr(): this is Err<never> {
        return false;
    }

    public override orThrow(): T {
        return this.#value;
    }

    public override orGet(_supplier: Supplier<T>): T {
        return this.#value;
    }

    public override match<R>(matcher: ResultMatcher<T, never, R>): R {
        return matcher.ok(this.#value);
    }

    public override try(consumer: Consumer<T>): Catcher<never> {
        consumer(this.#value);
        return new Catcher<never>();
    }

    public override or(_other: Result<T, never>): Result<T, never> {
        return this;
    }

    public override and<S>(other: Result<S, never>): Result<S, never> {
        return other;
    }

    public override filter<M extends Error>(predicate: Predicate<T>, error: M): Result<T, M> {
        return predicate(this.#value) ? this : new Err(error);
    }

    public override map<S>(fn: Functional<T, S>): Result<S, never> {
        return new Ok(fn(this.#value));
    }

    public override flatMap<S>(fn: Functional<T, Result<S, never>>): Result<S, never> {
        return fn(this.#value);
    }

    public override *[Symbol.iterator](): IterableIterator<T> {
        yield this.#value;
    }
}

export class Err<E extends Error = Error> extends Result<never, E> {
    readonly #error: E;

    public constructor(error: E) {
        super();
        this.#error = error;
    }

    public get error(): E {
        return this.#error;
    }

    public override isOk(): this is Ok<never> {
        return false;
    }

    public override isErr(): this is Err<E> {
        return true;
    }

    public override orThrow(): never {
        throw this.#error;
    }

    public override orGet<T>(supplier: Supplier<T>): T {
        return supplier();
    }

    public override match<R>(matcher: ResultMatcher<never, E, R>): R {
        return matcher.err(this.#error);
    }

    public override try(_consumer: Consumer<never>): Catcher<E> {
        return new Catcher(this.#error);
    }

    public override or<T>(other: Result<T, E>): Result<T, E> {
        return other;
    }

    public override and<S>(_other: Result<S, E>): Result<S, E> {
        return this;
    }

    public override filter<M extends Error>(_predicate: Predicate<never>, _error: M): Result<never, E> {
        return this;
    }

    public override map<S>(_fn: Functional<never, S>): Result<S, E> {
        return this;
    }

    public override flatMap<S>(_fn: Functional<never, Result<S, E>>): Result<S, E> {
        return this;
    }

    public override *[Symbol.iterator](): IterableIterator<never> {}
}