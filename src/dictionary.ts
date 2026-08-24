import { isSome, Some } from "./optional";
import { Stream } from "./stream";

export class Dictionary<T> {
    [key: string | number]: Some<T> | undefined;

    readonly #data: Record<string, Some<T>>;

    constructor(iterable?: Iterable<[keyof any, T]>) {
        this.#data = Object.fromEntries(
            Stream.from(iterable ?? []).map(([key, value]) => [String(key), Some.of(value)])
        );

        return new Proxy(this, {
            get(target, prop, receiver) {
                if (typeof prop === 'symbol' || prop in target) {
                    const value = Reflect.get(target, prop, receiver);
                    return typeof value === 'function' ? (value as any).bind(target) : value;
                }
                return target.#data[prop as string];
            },

            set(target, prop, value, receiver) {
                if (typeof prop === 'symbol' || prop in target) {
                    return Reflect.set(target, prop, value, receiver);
                }
                target.#data[prop as string] = value instanceof Some ? value : Some.of(value);
                return true;
            },

            has(target, prop) {
                return (prop in target) || (prop in target.#data);
            },

            ownKeys(target) {
                return [
                    ...Reflect.ownKeys(target),
                    ...Object.getOwnPropertyNames(target.#data)
                ];
            },

            getOwnPropertyDescriptor(target, prop) {
                if (prop in target.#data) {
                    return {
                        enumerable: true,
                        configurable: true,
                        writable: true,
                        value: target.#data[prop as string]
                    };
                }
                return Reflect.getOwnPropertyDescriptor(target, prop);
            },

            deleteProperty(target, prop) {
                if (prop in target.#data) {
                    return delete target.#data[prop as string];
                }
                return Reflect.deleteProperty(target, prop);
            },

            defineProperty(target, prop, descriptor) {
                if (!(prop in target) && 'value' in descriptor) {
                    const rawValue = descriptor.value;
                    target.#data[prop as string] = rawValue instanceof Some ? rawValue : Some.of(rawValue);
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

    public static of<S>(obj: Record<keyof any, S>): Dictionary<S> {
        return new Dictionary(Object.entries(obj));
    }

    public static from<S>(iterable: Iterable<[keyof any, S]>): Dictionary<S> {
        return new Dictionary(iterable);
    }
}