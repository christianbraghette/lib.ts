import { TriConsumer, TriFunctional } from "./functional";
import { HashMap, Map } from "./map";
import { Mutex, SemaphoreLock } from "./concurrence";
import { Throwable } from "./result";
import { Stream } from "./stream";
import { IterableObject } from "./objects";
import { Optional } from "./optional";

class LockedHashTableError extends Error {
    constructor() {
        super("HashTable is locked");
    }
}

export class HashTable<K, V> {
    #map: Mutex<HashMap<K, V>>;

    constructor(iterable?: Iterable<[K, V]>) {
        this.#map = new Mutex(new HashMap(iterable));
    }

    public async open(): Promise<HashTableAccessor<K, V>> {
        return new HashTableAccessor(await this.#map.acquire());
    }

    public set(key: K, value: V): this {
        this.#map.run(map => map.set(key, value));
        return this;
    }

    public async add(...entries: [K, V][]): Promise<number> {
        const lock = await this.#map.acquire();
        try {
            return lock.get().add(...entries);
        } catch (error) {
            throw error
        } finally {
            lock.release()
        }
    }

    public async get(key: K): Promise<Optional<V>> {
        const lock = await this.#map.acquire();
        try {
            return lock.get().get(key);
        } catch (error) {
            throw error
        } finally {
            lock.release()
        }
    }

    public async has(...keys: K[]): Promise<boolean> {
        const lock = await this.#map.acquire();
        try {
            return lock.get().has(...keys);
        } catch (error) {
            throw error
        } finally {
            lock.release()
        }
    }

    public async delete(...keys: K[]): Promise<number> {
        const lock = await this.#map.acquire();
        try {
            return lock.get().delete(...keys);
        } catch (error) {
            throw error
        } finally {
            lock.release()
        }
    }

    public async clear(): Promise<void> {
        const lock = await this.#map.acquire();
        try {
            return lock.get().clear();
        } catch (error) {
            throw error
        } finally {
            lock.release()
        }
    }

    public async forEach(callbackfn: TriConsumer<V, K, this>): Promise<void> {
        const lock = await this.#map.acquire();
        try {
            return lock.get().forEach((key, value) => callbackfn(key, value, this));
        } catch (error) {
            throw error
        } finally {
            lock.release()
        }
    }

    public async keys(): Promise<Stream<K>> {
        const lock = await this.#map.acquire();
        try {
            return lock.get().keys();
        } catch (error) {
            throw error
        } finally {
            lock.release()
        }
    }

    public async values(): Promise<Stream<V>> {
        const lock = await this.#map.acquire();
        try {
            return lock.get().values();
        } catch (error) {
            throw error
        } finally {
            lock.release()
        }
    }

    public async entries(): Promise<Stream<[K, V]>> {
        const lock = await this.#map.acquire();
        try {
            return lock.get().entries();
        } catch (error) {
            throw error
        } finally {
            lock.release()
        }
    }

    public async *[Symbol.asyncIterator](): AsyncIterableIterator<[K, V]> {
        const lock = await this.#map.acquire();
        try {
            yield* lock.get();
        } catch (error) {
            throw error
        } finally {
            lock.release()
        }
    }

    public static from<R, S>(iterable: Iterable<[R, S]>): HashTable<R, S> {
        return new HashTable(iterable);
    }

    public static of<R, S>(...items: [R, S][]): HashTable<R, S> {
        return new HashTable(items);
    }
}

class HashTableAccessor<K, V> extends IterableObject<[K, V]> implements Map<K, V> {
    #lock: SemaphoreLock<HashMap<K, V>>;

    constructor(lock: SemaphoreLock<HashMap<K, V>>) {
        super();
        this.#lock = lock;
    }

    get #map(): HashMap<K, V> {
        return this.#lock.get();
    }

    #check(): Throwable<void> {
        if (!this.#lock.locked)
            throw new LockedHashTableError();
    }

    public close() {
        this.#lock.release();
    }

    public get size(): number {
        this.#check();
        return this.#map.size;
    }

    public set(key: K, value: V): this {
        this.#check();
        this.#map.set(key, value);
        return this;
    }

    public add(...entries: [K, V][]): number {
        this.#check();
        return this.#map.add(...entries);
    }

    public get(key: K): Optional<V> {
        this.#check();
        return this.#map.get(key);
    }

    public has(...keys: K[]): boolean {
        this.#check();
        return this.#map.has(...keys);
    }

    public delete(...keys: K[]): number {
        this.#check();
        return this.#map.delete(...keys);
    }

    public clear(): void {
        this.#check();
        return this.#map.clear();
    }

    public forEach(callbackfn: TriConsumer<V, K, this>): void {
        this.#check();
        return this.#map.forEach((value, key) => callbackfn(value, key, this));
    }

    public keys(): Stream<K> {
        this.#check();
        return this.#map.keys();
    }

    public values(): Stream<V> {
        this.#check();
        return this.#map.values();
    }

    public entries(): Stream<[K, V]> {
        this.#check();
        return this.#map.entries();
    }

    public map<S>(fn: TriFunctional<V, K, this, S>): HashMap<K, S> {
        const self = this;
        return new HashMap(function* () {
            for (const [key, value] of self)
                yield [key, fn(value, key, self)];
        }())
    }

    public flatMap<S>(fn: TriFunctional<V, K, this, S | Map<K, S>>): HashMap<K, S> {
        const self = this;
        return new HashMap(function* () {
            for (const [key, value] of self.iterator()) {
                const result = fn(value, key, self);
                if (result instanceof Map)
                    yield* result.iterator();
                else
                    yield [key, result];
            }
        }())
    }

    public [Symbol.iterator](): IterableIterator<[K, V]> {
        this.#check();
        return this.#map[Symbol.iterator]();
    }

    public get [Symbol.toStringTag](): string { return "HashTableAccessor" }
}