/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Consumer, Executor, Predicate, Supplier, Functional } from "./functional";
import { FunctionalObject, IterableObject } from "./objects";
import { None, Optional, Some } from "./optional";

/** Marks a type as coming from code that may throw `E`. It exists only at compile time. */
export type Throwable<T, E extends Error = Error> = T & { readonly __error?: E };
/** Extracts the success type from a Throwable. */
export type Try<T> = T extends Throwable<infer U> ? U : T;
/** Extracts the error type from a Throwable. */
export type Catch<T> = T extends Throwable<any, infer E> ? E : never;

/** Allows a trailing `finally` after `Result.try`. */
class Finalizer {
    static #instance = new Finalizer();

    protected constructor() { }

    /**
     * Runs a function unconditionally.
     * @param executor The function to run.
     */
    public finally(executor: Executor): void {
        executor();
    }

    /** Returns the shared instance. */
    public static of(): Finalizer {
        return Finalizer.#instance;
    }
}

/** Returned by `Result.try` to handle the error case. */
class Catcher<E extends Error> extends Finalizer {
    readonly #error?: E;

    private constructor(error?: E) {
        super();
        this.#error = error;
    }

    /**
     * Runs a function when the Result is an Err.
     * @param catcher Receives the error.
     * @returns An object with a trailing `finally`.
     */
    public catch(catcher: Consumer<E>): Finalizer {
        if (this.#error) {
            catcher(this.#error);
        }
        return new Finalizer();
    }

    /**
     * Creates a Catcher.
     * @param error The error to handle, if there is one.
     */
    public static of<E extends Error>(error?: E): Catcher<E> {
        return new Catcher(error);
    }
}

/** Type guard that checks whether a Result is an Ok. */
export function isOk<T, E extends Error>(result: Result<T, E>): result is Ok<T, E> {
    return result.isOk();
}

/** Type guard that checks whether a Result is an Err. */
export function isErr<T, E extends Error>(result: Result<T, E>): result is Err<E, T> {
    return result.isErr();
}

/** The two branches passed to `Result.match`. */
export interface ResultMatcher<T, E extends Error, R> {
    /** Called with the value of an Ok. */
    ok: (value: T) => R;
    /** Called with the error of an Err. */
    err: (error: E) => R;
}

/**
 * The outcome of an operation that can fail: either an Ok holding a value or an Err holding an Error.
 * @example
 * const parse = (text: string) => Result.ofThrowable<number, SyntaxError>(() => JSON.parse(text));
 * parse("42").orThrow(); // 42
 * parse("{").isErr(); // true
 * parse("{").map(n => n + 1).orElse(0); // 0
 */
export abstract class Result<T, E extends Error> extends IterableObject<T> implements FunctionalObject {
    /** Checks for success and narrows this to Ok, which exposes `.value`. */
    public abstract isOk(): this is Ok<T, E>;
    /** Checks for failure and narrows this to Err, which exposes `.error`. */
    public abstract isErr(): this is Err<E, T>;

    /**
     * Runs a function on success, with chained `catch` and `finally` for the other paths.
     * @param consumer Receives the value of an Ok.
     * @example
     * Ok.of<string, Error>("v").try(v => v.length).catch(e => e.message).finally(() => undefined);
     */
    public abstract try(consumer: Consumer<T>): Catcher<E>;

    /**
     * Unwraps the value.
     * @param value Returned when this is an Err.
     */
    public abstract orElse(value: T): T;
    /**
     * Unwraps the value, computing a fallback only when needed.
     * @param supplier Called when this is an Err.
     */
    public abstract orGet(supplier: Supplier<T>): T;
    /** Converts this to an Optional, discarding any error. */
    public abstract orNone(): Optional<T>;
    /**
     * Unwraps the value or throws.
     * @param error Thrown instead of the Err's own error.
     * @throws The given error, or the Err's own error, when this is an Err.
     */
    public abstract orThrow<M extends Error = E>(error?: M): T;

    /** Returns this Result when it is an Ok, otherwise `other`. */
    public abstract or(other: Result<T, E>): Result<T, E>;
    /** Returns `other` when this is an Ok, otherwise an Err with this Result's error. */
    public abstract and<S>(other: Result<S, E>): Result<S, E>;
    /**
     * Handles both cases and returns a result.
     * @param matcher The `ok` and `err` branches.
     */
    public abstract match<R>(matcher: ResultMatcher<T, E, R>): R;
    /**
     * Turns an Ok into an Err when a predicate rejects its value.
     * @param predicate Receives the value.
     * @param error Used when the predicate rejects the value.
     */
    public abstract filter(predicate: Predicate<T>, error: E): Result<T, E>;
    /**
     * Transforms the value of an Ok.
     * @param fn Receives the value.
     */
    public abstract map<S>(fn: Functional<T, S>): Result<S, E>;
    /**
     * Transforms the value of an Ok with a function that itself returns a Result.
     * @param fn Receives the value.
     */
    public abstract flatMap<S>(fn: Functional<T, Result<S, E>>): Result<S, E>;
    /**
     * Transforms the error of an Err.
     * @param fn Receives the error.
     */
    public abstract mapError<M extends Error>(fn: Functional<E, M>): Result<T, M>;

    public get [Symbol.toStringTag](): string { return "Result"; }
}
export namespace Result {
    function toError<E extends Error>(thrown: unknown): E {
        return (thrown instanceof Error ? thrown : new Error(String(thrown))) as E;
    }

    /** Runs `supplier` and captures its return value in an Ok, or anything it throws in an Err. */
    export function ofThrowable<T, E extends Error = Error>(supplier: Supplier<T>): Result<T, E> {
        try {
            return new Ok<T, E>(supplier());
        } catch (e) {
            return new Err<E, T>(toError<E>(e));
        }
    }

    /** Waits for `promise` and captures its value in an Ok, or its rejection in an Err. */
    export async function ofPromise<T, E extends Error = Error>(promise: PromiseLike<T>): Promise<Result<T, E>> {
        try {
            return new Ok<T, E>(await promise);
        } catch (e) {
            return new Err<E, T>(toError<E>(e));
        }
    }

    type FromResult<R extends Result<any, any>> =
        R extends Result<infer S, infer E>
        ? R extends Err ? Err<E, S> : Ok<S, E>
        : never;

    /**
     * Copies a Result, narrowing the result type to Ok or Err when it is known.
     * @param result The Result to copy.
     */
    export function from<R extends Result<any, any>>(result: R): FromResult<R> {
        if (result.isOk())
            return Ok.of(result.value) as any;
        if (result.isErr())
            return Err.of(result.error) as any;
        throw Result.from;
    }
}

/** A successful Result. Create one with `Ok.of(value)`. */
export class Ok<T, E extends Error = never> extends Result<T, E> {
    readonly #value: T;

    /**
     * Creates an Ok.
     * @param value The value to hold.
     */
    public constructor(value: T) {
        super();
        this.#value = value;
    }

    /** The contained value. */
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

    /**
     * Creates an Ok.
     * @param value The value to hold.
     */
    public static of<S, M extends Error = never>(value: S): Ok<S, M> {
        return new Ok(value);
    }
}

/** A failed Result. Create one with `Err.of(error)`. */
export class Err<E extends Error = Error, T = never> extends Result<T, E> {
    readonly #error: E;

    /**
     * Creates an Err.
     * @param error The error to hold.
     */
    public constructor(error: E) {
        super();
        this.#error = error;
    }

    /** The contained error. */
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

    /**
     * Creates an Err.
     * @param error The error to hold.
     */
    public static of<M extends Error, S = never>(error: M): Err<M, S> {
        return new Err(error);
    }
}