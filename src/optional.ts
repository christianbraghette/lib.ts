/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Predicate, Supplier, Functional, Executor, Consumer } from "./functional";
import { FunctionalObject, IterableObject } from "./objects";
import { Err, Ok, Result } from "./result";

class EmptyOptionalError extends Error {
    constructor() {
        super(`Optional is empty`);
        this.name = "EmptyOptional";
    }
}

/** Type guard that checks whether an Optional holds a value. */
export function isSome<T>(obj: Optional<T>): obj is Some<T> {
    return obj.isSome();
}

/** Type guard that checks whether an Optional is empty. */
export function isNone<T>(obj: Optional<T>): obj is None<T> {
    return obj.isNone();
}

/** Returned by `Optional.ifSome` to allow a trailing `finally`. */
class Finalizer {
    static #instance = new Finalizer();

    private constructor() { }

    /**
     * Runs a function unconditionally.
     * @param executor The function to run.
     */
    public finally(executor: Executor): void {
        executor();
    }

    public static of(): Finalizer {
        return Finalizer.#instance;
    }
}

/** The two branches passed to `Optional.match`. */
export interface OptionalMatcher<T, R> {
    /** Called with the value when one is present. */
    some: (value: T) => R;
    /** Called when there is no value. */
    none: () => R;
}

/**
 * A value that may be absent: either a Some holding a value or a None. Collections return one wherever a lookup can miss, and it is safe to `await` or return from an `async` function.
 * @example
 * const port = Optional.ofNullable(undefined as string | undefined).map(Number).orElse(3000);
 * port + 1; // 3001
 * Some.of(2).map(n => n * 2).orThrow(); // 4
 * None.of<number>().match({ some: String, none: () => "empty" }); // empty
 */
export abstract class Optional<T> extends IterableObject<T> implements FunctionalObject {
    /** Checks for a value and narrows this to Some, which exposes `.value`. */
    public abstract isSome(): this is Some<T>;
    /** Checks for the absence of a value and narrows this to None. */
    public abstract isNone(): this is None<T>;

    /** Runs `fn` when a value is present. Deliberately not named `then`, which would make Optional a thenable. */
    public abstract ifSome(fn: Consumer<T>): Finalizer;

    /**
     * Unwraps the value.
     * @param defaultValue Returned when there is no value.
     */
    public abstract orElse(defaultValue: T): T;
    /**
     * Unwraps the value, computing a fallback only when needed.
     * @param supplier Called when there is no value.
     */
    public abstract orGet(supplier: Supplier<T>): T;
    /**
     * Converts this to a Result.
     * @param error Used for the Err when there is no value.
     */
    public abstract orErr<E extends Error>(error: E): Result<T, E>;
    /**
     * Unwraps the value or throws.
     * @param error Thrown when there is no value. Defaults to an "Optional is empty" error.
     * @throws The given error, or the default, when there is no value.
     */
    public abstract orThrow<E extends Error>(error?: E): T;

    /** Returns this Optional when it holds a value, otherwise `other`. */
    public abstract or(other: Optional<T>): Optional<T>;
    /** Returns `other` when this Optional holds a value, otherwise None. */
    public abstract and<S>(other: Optional<S>): Optional<S>;
    /**
     * Handles both cases and returns a result.
     * @param matcher The `some` and `none` branches.
     */
    public abstract match<R>(matcher: OptionalMatcher<T, R>): R;
    /**
     * Keeps the value only when a predicate accepts it.
     * @param predicate Receives the value.
     * @returns This Optional, or None when the predicate rejects the value.
     */
    public abstract filter(predicate: Predicate<T>): Optional<T>;
    /**
     * Transforms the value when one is present.
     * @param fn Receives the value.
     */
    public abstract map<S>(fn: Functional<T, S>): Optional<S>;
    /**
     * Transforms the value with a function that itself returns an Optional.
     * @param fn Receives the value.
     */
    public abstract flatMap<S>(fn: Functional<T, Optional<S>>): Optional<S>;

    public get [Symbol.toStringTag](): string { return "Optional"; }
}
export namespace Optional {
    /**
     * Wraps a value that may be `null` or `undefined`.
     * @param obj The value. Falsy values such as `0` and `""` are kept.
     * @returns None for `null` or `undefined`, otherwise a Some.
     */
    export function ofNullable<S>(obj: S): Optional<NonNullable<S>> {
        if (obj === undefined || obj === null)
            return None.of();
        return Some.of(obj);
    }

    type FromOptional<O extends Optional<any>> =
        O extends Optional<infer S>
        ? O extends None ? None<S> : Some<S>
        : never;

    /**
     * Copies an Optional, narrowing the result type to Some or None when it is known.
     * @param optional The Optional to copy.
     */
    export function from<O extends Optional<any>>(optional: O): FromOptional<O> {
        if (optional.isSome())
            return Some.of(optional.value) as any;
        return None.of() as any
    }
}

/** An Optional that holds a value. Create one with `Some.of(value)`. */
export class Some<T> extends Optional<T> {
    readonly #value: T;

    /**
     * Creates a Some.
     * @param value The value to hold.
     */
    public constructor(value: T) {
        super();
        this.#value = value;
    }

    public override isSome(): this is Some<T> {
        return true;
    }

    public override isNone(): this is None<T> {
        return false;
    }

    /** The contained value. */
    public get value(): T {
        return this.#value;
    }

    public override ifSome(fn: Consumer<T>) {
        fn(this.#value);
        return Finalizer.of();
    }

    public override orElse(_defaultValue: T): T {
        return this.#value;
    }

    public override orGet(_supplier: Supplier<T>): T {
        return this.#value;
    }

    public override orErr<E extends Error>(_error: E): Ok<T> {
        return new Ok(this.#value);
    }

    public override orThrow<E extends Error>(_error?: E): T {
        return this.#value;
    }

    public override or(_other: Optional<T>): Optional<T> {
        return this;
    }

    public override and<S>(other: Optional<S>): Optional<S> {
        return other;
    }

    public override match<R>(matcher: OptionalMatcher<T, R>): R {
        return matcher.some(this.#value);
    }

    public override filter(predicate: Predicate<T>): Optional<T> {
        return predicate(this.#value) ? this : None.of();
    }

    public override map<S>(fn: Functional<T, S>): Optional<S> {
        return new Some(fn(this.#value));
    }

    public override flatMap<S>(fn: Functional<T, Optional<S>>): Optional<S> {
        return fn(this.#value);
    }

    public override *[Symbol.iterator](): IterableIterator<T> {
        yield this.#value;
    }

    /**
     * Creates a Some.
     * @param value The value to hold.
     */
    public static of<S>(value: S): Some<S> {
        return new Some(value);
    }
}

/** An Optional with no value. Create one with `None.of()`. */
export class None<T = never> extends Optional<T> {
    static readonly #instance = new None<any>();

    public override isSome(): this is Some<T> {
        return false;
    }

    public override isNone(): this is None<T> {
        return true;
    }

    public override ifSome(_fn: Consumer<T>) {
        return Finalizer.of();
    }

    public override orElse(defaultValue: T): T {
        return defaultValue;
    }

    public override orGet(supplier: Supplier<T>): T {
        return supplier();
    }

    public override orErr<E extends Error>(error: E): Err<E, T> {
        return new Err(error);
    }

    public override orThrow<E extends Error>(error?: E): never {
        throw error ?? new EmptyOptionalError();
    }

    public override or(other: Optional<T>): Optional<T> {
        return other;
    }

    public override and<S>(_other: Optional<S>): Optional<S> {
        return None.#instance;
    }

    public override match<R>(matcher: OptionalMatcher<never, R>): R {
        return matcher.none();
    }

    public override filter(_predicate: Predicate<never>): Optional<T> {
        return this;
    }

    public override map<S>(_fn: Functional<never, S>): Optional<S> {
        return None.#instance;
    }

    public override flatMap<S>(_fn: Functional<never, Optional<S>>): Optional<S> {
        return None.#instance;
    }

    public override *[Symbol.iterator](): IterableIterator<never> { }

    /** Returns the shared None instance. */
    public static of<S = never>(): None<S> {
        return None.#instance;
    }
}