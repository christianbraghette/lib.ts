import { Consumer, Executor, Predicate, Supplier, Functional, Thrower } from "./functional";
import { FunctionalObject, IterableObject } from "./objects";
import { None, Optional, Some } from "./optional";

export type Throwable<T, E extends Error = Error> = T & { readonly __error?: E };
export type Try<T> = T extends Throwable<infer U> ? U : T;
export type Catch<T> = T extends Throwable<any, infer E> ? E : never;

class Finalizer {
    static #instance = new Finalizer();

    protected constructor() { }

    public finally(executor: Executor): void {
        executor();
    }

    public static of(): Finalizer {
        return Finalizer.#instance;
    }
}

class Catcher<E extends Error> extends Finalizer {
    readonly #error?: E;

    private constructor(error?: E) {
        super();
        this.#error = error;
    }

    public catch(catcher: Consumer<E>): Finalizer {
        if (this.#error) {
            catcher(this.#error);
        }
        return new Finalizer();
    }

    public static of<E extends Error>(error?: E): Catcher<E> {
        return new Catcher(error);
    }
}

export function isOk<T, E extends Error>(result: Result<T, E>): result is Ok<T, E> {
    return result.isOk();
}

export function isErr<T, E extends Error>(result: Result<T, E>): result is Err<E, T> {
    return result.isErr();
}

export interface ResultMatcher<T, E extends Error, R> {
    ok: (value: T) => R;
    err: (error: E) => R;
}

export abstract class Result<T, E extends Error> extends IterableObject<T> implements FunctionalObject {
    public abstract isOk(): this is Ok<T, E>;
    public abstract isErr(): this is Err<E, T>;

    public abstract try(consumer: Consumer<T>): Catcher<E>;

    public abstract orElse(value: T): T;
    public abstract orGet(supplier: Supplier<T>): T;
    public abstract orNone(): Optional<T>;
    public abstract orThrow<M extends Error = E>(error?: M): T;

    public abstract or(other: Result<T, E>): Result<T, E>;
    public abstract and<S>(other: Result<S, E>): Result<S, E>;
    public abstract match<R>(matcher: ResultMatcher<T, E, R>): R;
    public abstract filter(predicate: Predicate<T>, error: E): Result<T, E>;
    public abstract map<S>(fn: Functional<T, S>): Result<S, E>;
    public abstract flatMap<S>(fn: Functional<T, Result<S, E>>): Result<S, E>;
    public abstract mapError<M extends Error>(fn: Functional<E, M>): Result<T, M>;

    public get [Symbol.toStringTag](): string { return "Result"; }
}
export namespace Result {
    export function ofThrowable<M extends Error, S = never>(thrower: Thrower<M>): Result<S, M> {
        try {
            return new Ok(thrower());
        } catch (e) {
            return new Err(e instanceof Error ? e : new Error(String(e))) as Err<M, S>;
        }
    }

    type FromResult<R extends Result<any, any>> =
        R extends Result<infer S, infer E>
        ? R extends Err ? Err<E, S> : Ok<S, E>
        : never;

    export function from<R extends Result<any, any>>(result: R): FromResult<R> {
        if (result.isOk())
            return Ok.of(result.value) as any;
        if (result.isErr())
            return Err.of(result.error) as any;
        throw Result.from;
    }
}

export class Ok<T, E extends Error = never> extends Result<T, E> {
    readonly #value: T;

    public constructor(value: T) {
        super();
        this.#value = value;
    }

    public get value(): T {
        return this.#value;
    }

    public override isOk(): this is Ok<T, E> {
        return true;
    }

    public override isErr(): this is Err<E, T> {
        return false;
    }

    public override orElse(_value: T): T {
        return this.#value;
    }

    public override orThrow(): T {
        return this.#value;
    }

    public override orGet(_supplier: Supplier<T>): T {
        return this.#value;
    }

    public override match<R>(matcher: ResultMatcher<T, E, R>): R {
        return matcher.ok(this.#value);
    }

    public override try(consumer: Consumer<T>): Catcher<E> {
        consumer(this.#value);
        return Catcher.of();
    }

    public override or(_other: Result<T, E>): Ok<T, E> {
        return this;
    }

    public override and<S>(other: Result<S, E>): Result<S, E> {
        return other;
    }

    public override filter(predicate: Predicate<T>, error: E): Result<T, E> {
        return predicate(this.#value) ? this : new Err(error);
    }

    public override map<S>(fn: Functional<T, S>): Ok<S, E> {
        return new Ok(fn(this.#value));
    }

    public override mapError<M extends Error>(_fn: Functional<E, M>): Ok<T, M> {
        return new Ok(this.#value);
    }

    public override flatMap<S>(fn: Functional<T, Result<S, E>>): Result<S, E> {
        return fn(this.#value);
    }

    public override orNone(): Some<T> {
        return Some.of(this.#value);
    }

    public override *[Symbol.iterator](): IterableIterator<T> {
        yield this.#value;
    }

    public static of<S, M extends Error = never>(value: S): Ok<S, M> {
        return new Ok(value);
    }
}

export class Err<E extends Error = Error, T = never> extends Result<T, E> {
    readonly #error: E;

    public constructor(error: E) {
        super();
        this.#error = error;
    }

    public get error(): E {
        return this.#error;
    }

    public override isOk(): this is Ok<T, E> {
        return false;
    }

    public override isErr(): this is Err<E, T> {
        return true;
    }

    public override orElse(value: T): T {
        return value;
    }

    public override orThrow<M extends Error = E>(error?: M): never {
        throw error ?? this.#error;
    }

    public override orGet(supplier: Supplier<T>): T {
        return supplier();
    }

    public override match<R>(matcher: ResultMatcher<never, E, R>): R {
        return matcher.err(this.#error);
    }

    public override try(_consumer: Consumer<never>): Catcher<E> {
        return Catcher.of(this.#error);
    }

    public override or(other: Result<T, E>): Result<T, E> {
        return other;
    }

    public override and<S>(_other: Result<S, E>): Result<S, E> {
        return new Err(this.#error);
    }

    public override filter(_predicate: Predicate<never>, _error: E): Err<E, T> {
        return this;
    }

    public override map<S>(_fn: Functional<never, S>): Err<E, S> {
        return new Err(this.#error);
    }

    public override mapError<M extends Error>(fn: Functional<E, M>): Err<M, T> {
        return new Err(fn(this.#error));
    }

    public override flatMap<S>(_fn: Functional<never, Result<S, E>>): Err<E, S> {
        return new Err(this.#error);
    }

    public override orNone(): None<T> {
        return None.of();
    }

    public override *[Symbol.iterator](): IterableIterator<never> { }

    public static of<M extends Error, S = never>(error: M): Err<M, S> {
        return new Err(error);
    }
}