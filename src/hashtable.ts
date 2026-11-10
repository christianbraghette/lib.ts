/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { TriConsumer, TriFunctional } from "./functional";
import { HashMap, Map } from "./map";
import { Mutex, SemaphoreLock } from "./concurrence";
import { Throwable } from "./result";
import { StreamIterator } from "./stream";
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

    public add(...entries: [K, V][]): Promise<number> {
        return this.#map.run(map => map.add(...entries));
    }

    public get(key: K): Promise<Optional<V>> {
        return this.#map.run(map => map.get(key));
    }

    public has(...keys: K[]): Promise<boolean> {
        return this.#map.run(map => map.has(...keys));
    }

    public delete(...keys: K[]): Promise<number> {
        return this.#map.run(map => map.delete(...keys));
    }

    public clear(): Promise<void> {
        return this.#map.run(map => map.clear());
    }

    public forEach(callbackfn: TriConsumer<V, K, this>): Promise<void> {
        return this.#map.run(map => map.forEach((value, key) => callbackfn(value, key, this)));
    }

    // keys, values and entries return snapshots, because the streams outlive the lock.

    public keys(): Promise<StreamIterator<K>> {
        return this.#map.run(map => StreamIterator.from(map.keys().toArray()));
    }

    public values(): Promise<StreamIterator<V>> {
        return this.#map.run(map => StreamIterator.from(map.values().toArray()));
    }

    public entries(): Promise<StreamIterator<[K, V]>> {
        return this.#map.run(map => StreamIterator.from(map.entries().toArray()));
    }

    public async *[Symbol.asyncIterator](): AsyncIterableIterator<[K, V]> {
        const lock = await this.#map.acquire();
        try {
            yield* lock.get();
        } finally {
            lock.release()
        }
    }

    public get [Symbol.toStringTag](): string { return "HashTable"; }

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

    public keys(): StreamIterator<K> {
        this.#check();
        return this.#map.keys();
    }

    public values(): StreamIterator<V> {
        this.#check();
        return this.#map.values();
    }

    public entries(): StreamIterator<[K, V]> {
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