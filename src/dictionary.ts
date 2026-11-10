/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { isSome, Some } from "./optional";
import { StreamIterator } from "./stream";

/**
 * A string-keyed object whose properties read as `Some<T> | undefined`, so a present value and a missing key stay distinct. Assigning a plain value wraps it in a Some, and any key name is allowed, including `constructor`.
 * @example
 * const config = Dictionary.of({ host: "localhost" });
 * config.host?.value; // localhost
 * config.missing; // undefined
 * "host" in config; // true
 * [...config]; // [["host", "localhost"]]
 */
export class Dictionary<T> {
    [key: string | number]: Some<T> | undefined;

    /** Has no prototype, so keys like `constructor` or `__proto__` are ordinary entries. */
    readonly #data: Record<string, Some<T>> = Object.create(null);

    /**
     * Creates a dictionary.
     * @param iterable The initial `[key, value]` pairs. Keys are converted to strings.
     */
    constructor(iterable?: Iterable<[keyof any, T]>) {
        for (const [key, value] of StreamIterator.from(iterable ?? []))
            this.#data[String(key)] = Some.of(value);

        return new Proxy(this, {
            get(target, prop, receiver) {
                if (typeof prop === 'string' && prop in target.#data)
                    return target.#data[prop];

                const value = Reflect.get(target, prop, receiver);
                return typeof value === 'function' ? (value as any).bind(target) : value;
            },

            set(target, prop, value, receiver) {
                if (typeof prop === 'symbol')
                    return Reflect.set(target, prop, value, receiver);

                target.#data[prop] = value instanceof Some ? value : Some.of(value);
                return true;
            },

            has(target, prop) {
                return typeof prop === 'symbol' ? Reflect.has(target, prop) : prop in target.#data;
            },

            ownKeys(target) {
                return [
                    ...Reflect.ownKeys(target),
                    ...Object.getOwnPropertyNames(target.#data)
                ];
            },

            getOwnPropertyDescriptor(target, prop) {
                if (typeof prop === 'string' && prop in target.#data) {
                    return {
                        enumerable: true,
                        configurable: true,
                        writable: true,
                        value: target.#data[prop]
                    };
                }
                return Reflect.getOwnPropertyDescriptor(target, prop);
            },

            deleteProperty(target, prop) {
                if (typeof prop === 'string' && prop in target.#data)
                    return delete target.#data[prop];
                return Reflect.deleteProperty(target, prop);
            },

            defineProperty(target, prop, descriptor) {
                if (typeof prop === 'string' && 'value' in descriptor) {
                    const rawValue = descriptor.value;
                    target.#data[prop] = rawValue instanceof Some ? rawValue : Some.of(rawValue);
                    return true;
                }
                return Reflect.defineProperty(target, prop, descriptor);
            }
        });
    }

    public *[Symbol.iterator](): IterableIterator<[string, T]> {
        for (const [key, value] of Object.entries(this.#data)) {
            if (isSome(value))
                yield [key, value.value];
        }
    }

    public get [Symbol.toStringTag](): string {
        return "Dictionary";
    }

    /**
     * Creates a dictionary from the properties of an object.
     * @param obj The source object.
     */
    public static of<S>(obj: Record<keyof any, S>): Dictionary<S> {
        return new Dictionary(Object.entries(obj));
    }

    /**
     * Creates a dictionary from an iterable of `[key, value]` pairs.
     * @param iterable The initial entries. Keys are converted to strings.
     */
    public static from<S>(iterable: Iterable<[keyof any, S]>): Dictionary<S> {
        return new Dictionary(iterable);
    }
}
