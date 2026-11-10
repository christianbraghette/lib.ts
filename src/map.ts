/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Comparator, TriConsumer, TriFunctional } from "./functional";
import { StreamIterator } from "./stream";
import { NativeMap } from "./native";
import { FunctionalObject, IterableObject } from "./objects";
import { None, Optional, Some } from "./optional";

/** Base class of every map. Importing this name shadows the native `Map` in that file. */
export abstract class Map<K, V> extends IterableObject<[K, V]> implements FunctionalObject {
    /** The number of entries. */
    abstract readonly size: number;

    /** Removes every entry. */
    abstract clear(): void;
    /**
     * Adds an entry, replacing the value when the key already exists.
     * @param key The entry's key.
     * @param value The entry's value.
     * @returns This map, for chaining.
     */
    abstract set(key: K, value: V): this;
    /**
     * Adds several entries, replacing the value of any key that already exists.
     * @param entries The `[key, value]` pairs to add.
     * @returns How many keys are new.
     */
    abstract add(...entries: [K, V][]): number;
    /**
     * Checks whether the map contains the given keys.
     * @param keys The keys to look for.
     * @returns `true` when every key is present, and `false` when called with no keys.
     */
    abstract has(...keys: K[]): boolean;
    /**
     * Removes the entries with the given keys.
     * @param keys The keys to remove.
     * @returns How many entries were actually removed.
     */
    abstract delete(...keys: K[]): number;
    /**
     * Reads the value of a key.
     * @param key The key to look up.
     * @returns The value, or None when the key is absent.
     */
    abstract get(key: K): Optional<V>;
    /**
     * Calls a function for each entry in iteration order.
     * @param consumer Receives the value, its key and this map.
     */
    abstract forEach(consumer: TriConsumer<V, K, this>): void;

    /** Starts a stream over the keys. */
    abstract keys(): StreamIterator<K>
    /** Starts a stream over the values. */
    abstract values(): StreamIterator<V>;
    /** Starts a stream over the `[key, value]` pairs. */
    abstract entries(): StreamIterator<[K, V]>

    /**
     * Builds a new map with the same keys and transformed values.
     * @param fn Receives the value, its key and this map.
     * @returns A new map, populated immediately.
     */
    abstract map<S>(fn: TriFunctional<V, K, this, S>): Map<K, S>;
    /**
     * Like `map`, but the entries of a returned Map are merged into the result.
     * @param fn Returns either a new value for this key or a Map of entries.
     * @returns A new map, populated immediately.
     */
    abstract flatMap<S>(fn: TriFunctional<V, K, this, S | Map<K, S>>): Map<K, S>

    abstract [Symbol.iterator](): IterableIterator<[K, V]>;
}

/** A map kept in key order. */
export abstract class SortedMap<K, V> extends Map<K, V> {
    /**
     * Reads the lowest key.
     * @returns The key, or None when the map is empty.
     */
    abstract first(): Optional<K>;
    /**
     * Reads the highest key.
     * @returns The key, or None when the map is empty.
     */
    abstract last(): Optional<K>;
    /** Returns the comparator that defines this map's key order. */
    abstract comparator(): Comparator<K>;
    /**
     * Copies the entries with keys lower than `key` into a new map.
     * @param key The exclusive upper bound.
     */
    abstract head(key: K): SortedMap<K, V>;
    /**
     * Copies the entries with keys equal to or higher than `key` into a new map.
     * @param key The inclusive lower bound.
     */
    abstract tail(key: K): SortedMap<K, V>;
    /**
     * Copies a range of entries into a new map.
     * @param fromKey The inclusive lower bound.
     * @param toKey The exclusive upper bound.
     */
    abstract slice(fromKey: K, toKey: K): SortedMap<K, V>;
}

/**
 * A map backed by the native `Map`, iterating in insertion order.
 * @example
 * const ages = new HashMap<string, number>().set("ada", 36);
 * ages.get("ada").orElse(0); // 36
 * ages.get("bob").isNone(); // true
 * ages.keys().toArray(); // ["ada"]
 */
export class HashMap<K, V> extends Map<K, V> {
    #map: NativeMap<K, V>;

    /**
     * Creates a map.
     * @param iterable An optional iterable of key-value pairs to initialize the map.
     */
    constructor(iterable?: Iterable<[K, V]>) {
        super();
        this.#map = new NativeMap(iterable);
    }

    /**
     * Gets the number of elements in the map.
     */
    get size(): number {
        return this.#map.size;
    }

    /**
     * Adds or updates an element with a specified key and value.
     * @param key The key of the element to add.
     * @param value The value of the element to add.
     * @returns The HashMap instance for method chaining.
     */
    public set(key: K, value: V): this {
        this.#map.set(key, value);
        return this;
    }

    public add(...entries: [K, V][]): number {
        const size = this.#map.size;
        for (const [key, value] of entries)
            this.#map.set(key, value);
        return this.#map.size - size;
    }

    /**
     * Returns a specified element from the map.
     * @param key The key of the element to return.
     * @returns An Optional holding the element for the specified key, or None if not found.
     */
    public get(key: K): Optional<V> {
        if (!this.#map.has(key))
            return None.of()
        return Some.of(this.#map.get(key)! as V);
    }

    /**
     * Returns true when every specified key exists, and false when called with no keys.
     * @param keys The keys to test for presence.
     */
    public has(...keys: K[]): boolean {
        if (keys.length === 0) return false;
        for (const key of keys)
            if (!this.#map.has(key))
                return false;
        return true;
    }

    /**
     * Removes the specified elements from the map.
     * @param keys The keys of the elements to remove.
     * @returns The number of elements that were removed.
     */
    public delete(...keys: K[]): number {
        const size = this.#map.size;
        for (const key of keys)
            this.#map.delete(key)
        return size - this.#map.size;
    }

    /**
     * Removes all elements from the map.
     */
    public clear(): void {
        this.#map.clear();
    }

    /**
     * Executes a provided function once per each key/value pair in the map.
     * @param callbackfn Function to execute for each element.
     */
    public forEach(callbackfn: TriConsumer<V, K, this>): void {
        for (const [key, value] of this.entries()) {
            callbackfn(value, key, this);
        }
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

    /**
     * Returns a new Iterator object that contains the keys for each element in the map.
     */
    public keys(): StreamIterator<K> {
        return StreamIterator.from(this.#map.keys());
    }

    /**
     * Returns a new Iterator object that contains the values for each element in the map.
     */
    public values(): StreamIterator<V> {
        return StreamIterator.from(this.#map.values());
    }

    /**
     * Returns a new Iterator object that contains the [key, value] pairs for each element in the map.
     */
    public entries(): StreamIterator<[K, V]> {
        return StreamIterator.from(this.#map.entries());
    }

    /**
     * Default iterator for the class, allowing usage in for...of loops.
     */
    [Symbol.iterator](): IterableIterator<[K, V]> {
        return this.#map.entries();
    }

    get [Symbol.toStringTag](): string { return "HashMap"; }

    /**
     * Creates a map from an iterable of `[key, value]` pairs.
     * @param iterable The initial entries.
     */
    public static from<R, S>(iterable: Iterable<[R, S]>): HashMap<R, S> {
        return new HashMap(iterable);
    }

    /**
     * Creates a map from `[key, value]` arguments.
     * @param items The initial entries.
     */
    public static of<R, S>(...items: [R, S][]): HashMap<R, S> {
        return new HashMap(items);
    }
}

/**
 * A HashMap where setting a key moves it to the end, so iteration runs from least to most recently set. Reading a key does not move it, and there is no capacity limit or eviction.
 * @example
 * const recent = CacheMap.of(["a", 1], ["b", 2]);
 * recent.set("a", 3);
 * recent.keys().toArray(); // ["b", "a"]
 */
export class CacheMap<K, V> extends HashMap<K, V> {
    /**
     * Adds or replaces an entry and moves its key to the end.
     * @param key The entry's key.
     * @param value The entry's value.
     * @returns This map, for chaining.
     */
    public override set(key: K, value: V): this {
        super.delete(key);
        super.set(key, value);
        return this;
    }

    /**
     * Adds or replaces several entries, moving each key to the end.
     * @param entries The `[key, value]` pairs to add.
     * @returns How many keys are new.
     */
    public override add(...entries: [K, V][]): number {
        const size = this.size;
        for (const [key, value] of entries) {
            super.delete(key);
            super.set(key, value);
        }
        return this.size - size;
    }

    public map<S>(fn: TriFunctional<V, K, this, S>): CacheMap<K, S> {
        const self = this;
        return new CacheMap(function* () {
            for (const [key, value] of self)
                yield [key, fn(value, key, self)];
        }())
    }

    public flatMap<S>(fn: TriFunctional<V, K, this, S | Map<K, S>>): CacheMap<K, S> {
        const self = this;
        return new CacheMap(function* () {
            for (const [key, value] of self.iterator()) {
                const result = fn(value, key, self);
                if (result instanceof Map)
                    yield* result.iterator();
                else
                    yield [key, result];
            }
        }())
    }

    override get [Symbol.toStringTag](): string { return "CacheMap"; }

    /**
     * Creates a map from an iterable of `[key, value]` pairs.
     * @param iterable The initial entries.
     */
    public static override from<R, S>(iterable: Iterable<[R, S]>): CacheMap<R, S> {
        return new CacheMap(iterable);
    }

    /**
     * Creates a map from `[key, value]` arguments.
     * @param items The initial entries.
     */
    public static override of<R, S>(...items: [R, S][]): CacheMap<R, S> {
        return new CacheMap(items);
    }
}

class TreeNode<K, V> {
    public entries: [K, V][] = [];
    public children: TreeNode<K, V>[] = [];
    public isLeaf: boolean = true;
}

/**
 * A map kept in key order by a comparator, backed by a B-tree. Keys the comparator treats as equal are the same key.
 * @example
 * const map = TreeMap.of(Comparator.natural<number>(), [2, "b"], [1, "a"]);
 * map.first().orThrow(); // 1
 * map.values().toArray(); // ["a", "b"]
 */
export class TreeMap<K, V> extends SortedMap<K, V> {
    #size: number = 0;
    #root: TreeNode<K, V>;
    #compareFn: Comparator<K>;
    readonly #M = 4;

    /**
     * Creates a sorted map.
     * @param compareFn Defines the key order and which keys count as equal.
     * @param iterable The initial entries. Defaults to an empty map.
     */
    constructor(compareFn: Comparator<K>, iterable?: Iterable<[K, V]>) {
        super();
        this.#compareFn = compareFn;
        this.#root = new TreeNode<K, V>();
        for (const [key, value] of iterable ?? []) {
            this.set(key, value);
        }
    }

    get size(): number {
        return this.#size;
    }

    public set(key: K, value: V): this {
        const root = this.#root;

        if (root.entries.length === this.#M - 1) {
            const newRoot = new TreeNode<K, V>();
            newRoot.isLeaf = false;
            newRoot.children.push(root);
            this.#root = newRoot;
            this.#splitChild(newRoot, 0, root);
            this.#insertNonFull(newRoot, key, value);
        } else {
            this.#insertNonFull(root, key, value);
        }

        return this;
    }

    #insertNonFull(node: TreeNode<K, V>, key: K, value: V): void {
        let i = node.entries.length - 1;

        if (node.isLeaf) {
            while (i >= 0 && this.#compareFn(key, node.entries[i][0]) < 0) {
                i--;
            }

            if (i >= 0 && this.#compareFn(key, node.entries[i][0]) === 0) {
                node.entries[i][1] = value;
                return;
            }

            node.entries.splice(i + 1, 0, [key, value]);
            this.#size++;
        } else {
            while (i >= 0 && this.#compareFn(key, node.entries[i][0]) < 0) {
                i--;
            }

            if (i >= 0 && this.#compareFn(key, node.entries[i][0]) === 0) {
                node.entries[i][1] = value;
                return;
            }

            i++;
            if (node.children[i].entries.length === this.#M - 1) {
                this.#splitChild(node, i, node.children[i]);
                const cmp = this.#compareFn(key, node.entries[i][0]);
                if (cmp > 0) {
                    i++;
                } else if (cmp === 0) {
                    node.entries[i][1] = value;
                    return;
                }
            }
            this.#insertNonFull(node.children[i], key, value);
        }
    }

    #splitChild(parent: TreeNode<K, V>, index: number, child: TreeNode<K, V>): void {
        const newChild = new TreeNode<K, V>();
        newChild.isLeaf = child.isLeaf;

        const medianIndex = Math.floor((this.#M - 1) / 2);
        const promotedEntry = child.entries[medianIndex];

        newChild.entries = child.entries.splice(medianIndex + 1);
        child.entries.pop();

        if (!child.isLeaf) {
            newChild.children = child.children.splice(medianIndex + 1);
        }

        parent.entries.splice(index, 0, promotedEntry);
        parent.children.splice(index + 1, 0, newChild);
    }

    public add(...entries: [K, V][]): number {
        const initialSize = this.#size;
        for (const [key, value] of entries) {
            this.set(key, value);
        }
        return this.#size - initialSize;
    }

    public get(key: K): Optional<V> {
        let current: TreeNode<K, V> | undefined = this.#root;

        while (current) {
            let i = 0;
            const len = current.entries.length;
            while (i < len && this.#compareFn(key, current.entries[i][0]) > 0) {
                i++;
            }

            if (i < len && this.#compareFn(key, current.entries[i][0]) === 0) {
                return Some.of(current.entries[i][1]);
            }

            current = current.isLeaf ? undefined : current.children[i];
        }
        return None.of();
    }

    public has(...keys: K[]): boolean {
        if (keys.length === 0) return false;
        for (const key of keys) {
            let current: TreeNode<K, V> | undefined = this.#root;
            let found = false;

            while (current) {
                let i = 0;
                const len = current.entries.length;
                while (i < len && this.#compareFn(key, current.entries[i][0]) > 0) {
                    i++;
                }
                if (i < len && this.#compareFn(key, current.entries[i][0]) === 0) {
                    found = true;
                    break;
                }
                current = current.isLeaf ? undefined : current.children[i];
            }
            if (!found) return false;
        }
        return true;
    }

    public delete(...keys: K[]): number {
        const initialSize = this.#size;

        for (const key of keys) {
            if (this.#size === 0) continue;

            this.#deleteTopDown(this.#root, key);

            if (this.#root.entries.length === 0 && !this.#root.isLeaf) {
                this.#root = this.#root.children[0];
            }
        }

        return initialSize - this.#size;
    }

    #deleteTopDown(node: TreeNode<K, V>, key: K): void {
        let i = 0;
        const len = node.entries.length;
        while (i < len && this.#compareFn(key, node.entries[i][0]) > 0) {
            i++;
        }

        const minKeys = Math.floor(this.#M / 2) - 1;

        if (i < len && this.#compareFn(key, node.entries[i][0]) === 0) {
            if (node.isLeaf) {
                node.entries.splice(i, 1);
                this.#size--;
            } else {
                const leftChild = node.children[i];
                const rightChild = node.children[i + 1];

                if (leftChild.entries.length > minKeys) {
                    const pred = this.#getExtremeEntry(leftChild, "last");
                    node.entries[i] = pred;
                    this.#deleteTopDown(leftChild, pred[0]);
                } else if (rightChild.entries.length > minKeys) {
                    const succ = this.#getExtremeEntry(rightChild, "first");
                    node.entries[i] = succ;
                    this.#deleteTopDown(rightChild, succ[0]);
                } else {
                    this.#mergeChildren(node, i);
                    this.#deleteTopDown(leftChild, key);
                }
            }
        } else {
            if (node.isLeaf) return;

            const child = node.children[i];

            if (child.entries.length === minKeys) {
                const leftSibling = i > 0 ? node.children[i - 1] : undefined;
                const rightSibling = i < node.children.length - 1 ? node.children[i + 1] : undefined;

                if (leftSibling && leftSibling.entries.length > minKeys) {
                    child.entries.unshift(node.entries[i - 1]);
                    node.entries[i - 1] = leftSibling.entries.pop()!;
                    if (!child.isLeaf) {
                        child.children.unshift(leftSibling.children.pop()!);
                    }
                } else if (rightSibling && rightSibling.entries.length > minKeys) {
                    child.entries.push(node.entries[i]);
                    node.entries[i] = rightSibling.entries.shift()!;
                    if (!child.isLeaf) {
                        child.children.push(rightSibling.children.shift()!);
                    }
                } else {
                    if (leftSibling) {
                        this.#mergeChildren(node, i - 1);
                        this.#deleteTopDown(node.children[i - 1], key);
                        return;
                    } else {
                        this.#mergeChildren(node, i);
                    }
                }
            }
            this.#deleteTopDown(node.children[i], key);
        }
    }

    #mergeChildren(parent: TreeNode<K, V>, index: number): void {
        const left = parent.children[index];
        const right = parent.children[index + 1];
        const promoted = parent.entries.splice(index, 1)[0];
        parent.children.splice(index + 1, 1);

        left.entries.push(promoted, ...right.entries);

        if (!left.isLeaf) {
            left.children.push(...right.children);
        }
    }

    #getExtremeEntry(node: TreeNode<K, V>, side: "first" | "last"): [K, V] {
        let current = node;
        while (!current.isLeaf) {
            current = current.children[side === "first" ? 0 : current.children.length - 1];
        }
        return current.entries[side === "first" ? 0 : current.entries.length - 1];
    }

    public clear(): void {
        this.#root = new TreeNode<K, V>();
        this.#size = 0;
    }

    public first(): Optional<K> {
        if (this.#size === 0) return None.of();
        let current = this.#root;
        while (!current.isLeaf) {
            current = current.children[0];
        }
        return Some.of(current.entries[0][0]);
    }

    public last(): Optional<K> {
        if (this.#size === 0) return None.of();
        let current = this.#root;
        while (!current.isLeaf) {
            current = current.children[current.children.length - 1];
        }
        return Some.of(current.entries[current.entries.length - 1][0]);
    }

    public comparator(): Comparator<K> {
        return this.#compareFn;
    }

    public head(toKey: K): TreeMap<K, V> {
        const subMap = new TreeMap<K, V>(this.#compareFn);
        for (const [key, value] of this.entries()) {
            if (this.#compareFn(key, toKey) >= 0) break;
            subMap.set(key, value);
        }
        return subMap;
    }

    public tail(fromKey: K): TreeMap<K, V> {
        const subMap = new TreeMap<K, V>(this.#compareFn);
        let startAdding = false;
        for (const [key, value] of this.entries()) {
            if (!startAdding && this.#compareFn(key, fromKey) >= 0) {
                startAdding = true;
            }
            if (startAdding) {
                subMap.set(key, value);
            }
        }
        return subMap;
    }

    public slice(fromKey: K, toKey: K): TreeMap<K, V> {
        if (this.#compareFn(fromKey, toKey) > 0)
            return new TreeMap(this.#compareFn);

        const subMap = new TreeMap<K, V>(this.#compareFn);
        for (const [key, value] of this.entries()) {
            const cmpFrom = this.#compareFn(key, fromKey);
            const cmpTo = this.#compareFn(key, toKey);

            if (cmpFrom >= 0 && cmpTo < 0) {
                subMap.set(key, value);
            } else if (cmpTo >= 0) {
                break;
            }
        }
        return subMap;
    }

    public forEach(consumer: TriConsumer<V, K, this>): void {
        for (const [key, value] of this.iterator())
            consumer(value, key, this);
    }

    public map<S>(fn: TriFunctional<V, K, this, S>): TreeMap<K, S> {
        const self = this;
        return new TreeMap(this.#compareFn, function* () {
            for (const [key, value] of self)
                yield [key, fn(value, key, self)];
        }());
    }

    public flatMap<S>(fn: TriFunctional<V, K, this, S | Map<K, S>>): TreeMap<K, S> {
        const self = this;
        return new TreeMap(this.#compareFn, function* () {
            for (const [key, value] of self.iterator()) {
                const result = fn(value, key, self);
                if (result instanceof Map)
                    yield* result.entries();
                else
                    yield [key, result];
            }
        }());
    }

    public keys(): StreamIterator<K> {
        return StreamIterator.from(this).map(([key]) => key);
    }

    public values(): StreamIterator<V> {
        return StreamIterator.from(this).map(([_, value]) => value);
    }

    public entries(): StreamIterator<[K, V]> {
        return StreamIterator.from(this);
    }

    *[Symbol.iterator](): IterableIterator<[K, V]> {
        const stack: { node: TreeNode<K, V>; index: number }[] = [];
        let current: TreeNode<K, V> | undefined = this.#root;
        let idx = 0;

        while (stack.length > 0 || current) {
            if (current) {
                stack.push({ node: current, index: idx });
                current = current.isLeaf ? undefined : current.children[0];
                idx = 0;
            } else {
                const state = stack.pop()!;
                const node = state.node;
                const i = state.index;

                if (i < node.entries.length) {
                    yield node.entries[i];
                    stack.push({ node: node, index: i + 1 });
                    current = node.isLeaf ? undefined : node.children[i + 1];
                    idx = 0;
                }
            }
        }
    }

    get [Symbol.toStringTag](): string { return "TreeMap"; }

    /**
     * Creates a sorted map from an iterable of `[key, value]` pairs.
     * @param compareFn Defines the key order.
     * @param iterable The initial entries.
     */
    public static from<R, S>(compareFn: Comparator<R>, iterable: Iterable<[R, S]>): TreeMap<R, S> {
        return new TreeMap(compareFn, iterable);
    }

    /**
     * Creates a sorted map from `[key, value]` arguments.
     * @param compareFn Defines the key order.
     * @param items The initial entries.
     */
    public static of<R, S>(compareFn: Comparator<R>, ...items: [R, S][]): TreeMap<R, S> {
        return new TreeMap(compareFn, items);
    }
}