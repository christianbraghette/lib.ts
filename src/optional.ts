import { Predicate, Supplier, Functional } from "./functional";
import { FunctionalObject, IterableObject } from "./objects";
import { Err, Ok, Result } from "./result";

class EmptyOptionalError extends Error {
    constructor() {
        super(`Optional is empty`);
        this.name = "EmptyOptional";
    }
}

interface OptionalMatcher<T, R> {
    some: (value: T) => R;
    none: () => R;
}

export abstract class Optional<T> extends IterableObject<T> implements FunctionalObject {
    public abstract isSome(): this is Some<T>;
    public abstract isNone(): this is None;

    public abstract orElse(defaultValue: T): T;
    public abstract orGet(supplier: Supplier<T>): T;
    public abstract orErr<E extends Error>(error: E): Result<T, E>;
    public abstract orThrow<E extends Error>(error?: E): T;

    public abstract or(other: Optional<T>): Optional<T>;
    public abstract and<S>(other: Optional<S>): Optional<S>;
    public abstract match<R>(matcher: OptionalMatcher<T, R>): R;
    public abstract filter(predicate: Predicate<T>): Optional<T>;
    public abstract map<S>(fn: Functional<T, S>): Optional<S>;
    public abstract flatMap<S>(fn: Functional<T, Optional<S>>): Optional<S>;

    public pipe(): Supplier<Optional<T>> {
        return () => this;
    }

    public static none(): None {
        return None.instance;
    }

    public static some<S>(value: S): Some<S> {
        return new Some(value);
    }

    public static of<S>(value: S): Optional<NonNullable<S>> {
        return (value === null || value === undefined
            ? None.instance
            : new Some(value as NonNullable<S>)) as Optional<NonNullable<S>>;
    }
}

export class Some<T> extends Optional<T> {
    readonly #value: T;

    public constructor(value: T) {
        super();
        this.#value = value;
    }

    public override isSome(): this is Some<T> {
        return true;
    }

    public override isNone(): this is None {
        return false;
    }

    public get value(): T {
        return this.#value;
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
        return predicate(this.#value) ? this : None.instance;
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
}

export class None extends Optional<never> {
    public static readonly instance = new None();

    public override isSome(): this is Some<never> {
        return false;
    }

    public override isNone(): this is None {
        return true;
    }

    public override orElse<T>(defaultValue: T): T {
        return defaultValue;
    }

    public override orGet<T>(supplier: Supplier<T>): T {
        return supplier();
    }

    public override orErr<E extends Error>(error: E): Err<E> {
        return new Err(error);
    }

    public override orThrow<E extends Error>(error?: E): never {
        throw error ?? new EmptyOptionalError();
    }

    public override or<T>(other: Optional<T>): Optional<T> {
        return other;
    }

    public override and<S>(_other: Optional<S>): Optional<S> {
        return None.instance;
    }

    public override match<R>(matcher: OptionalMatcher<never, R>): R {
        return matcher.none();
    }

    public override filter(_predicate: Predicate<never>): Optional<never> {
        return this;
    }

    public override map<S>(_fn: Functional<never, S>): Optional<S> {
        return None.instance;
    }

    public override flatMap<S>(_fn: Functional<never, Optional<S>>): Optional<S> {
        return None.instance;
    }

    public override *[Symbol.iterator](): IterableIterator<never> { }
}