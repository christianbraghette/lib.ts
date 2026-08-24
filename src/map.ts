import { Comparator, Supplier, TriConsumer, TriFunctional } from "./functional";
import { Stream } from "./stream";
import { NativeMap } from "./native";
import { FunctionalObject, IterableObject } from "./objects";
import { Optional } from "./optional";

export abstract class Map<K, V> extends IterableObject<[K, V]> implements FunctionalObject {
    abstract readonly size: number;

    abstract clear(): void;
    abstract set(key: K, value: V): this;
    abstract add(...entries: [K, V][]): number;
    abstract has(...keys: K[]): boolean;
    abstract delete(...keys: K[]): number;
    abstract get(key: K): Optional<V>;
    abstract forEach(consumer: TriConsumer<V, K, this>): void;

    abstract keys(): Stream<K>
    abstract values(): Stream<V>;
    abstract entries(): Stream<[K, V]>

    public pipe(): Supplier<this> {
        return () => this;
    }

    abstract map<S>(fn: TriFunctional<V, K, this, S>): Map<K, S>;
    abstract flatMap<S>(fn: TriFunctional<V, K, this, S | Map<K, S>>): Map<K, S>

    abstract [Symbol.iterator](): IterableIterator<[K, V]>;
}

export abstract class SortedMap<K, V> extends Map<K, V> {
    abstract first(): Optional<K>;
    abstract last(): Optional<K>;
    abstract comparator(): Comparator<K>;
    abstract head(key: K): SortedMap<K, V>;
    abstract tail(key: K): SortedMap<K, V>;
    abstract slice(fromKey: K, toKey: K): SortedMap<K, V>;
}

export class HashMap<K, V> extends Map<K, V> {
    #map: NativeMap<K, V>;

    /**
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
     * @returns The element associated with the specified key, or undefined if not found.
     */
    public get(key: K): Optional<V> {
        if (!this.#map.has(key))
            return Optional.none()
        return Optional.some(this.#map.get(key)!);
    }

    /**
     * Returns a boolean indicating whether an element with the specified key exists or not.
     * @param key The key to test for presence.
     */
    public has(...keys: K[]): boolean {
        if (keys.length === 0) return false;
        for (const key of keys)
            if (!this.#map.has(key))
                return false;
        return true;
    }

    /**
     * Removes the specified element from the map.
     * @param key The key of the element to remove.
     * @returns true if the element existed and was removed; false otherwise.
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
    public keys(): Stream<K> {
        return Stream.from(this.#map.keys());
    }

    /**
     * Returns a new Iterator object that contains the values for each element in the map.
     */
    public values(): Stream<V> {
        return Stream.from(this.#map.values());
    }

    /**
     * Returns a new Iterator object that contains the [key, value] pairs for each element in the map.
     */
    public entries(): Stream<[K, V]> {
        return Stream.from(this.#map.entries());
    }

    /**
     * Default iterator for the class, allowing usage in for...of loops.
     */
    [Symbol.iterator](): IterableIterator<[K, V]> {
        return this.#map.entries();
    }

    get [Symbol.toStringTag](): string { return "HashMap"; }

    public static from<R, S>(iterable: Iterable<[R, S]>): HashMap<R, S> {
        return new HashMap(iterable);
    }

    public static of<R, S>(...items: [R, S][]): HashMap<R, S> {
        return new HashMap(items);
    }
}

export class CacheMap<K, V> extends HashMap<K, V> {
    public override set(key: K, value: V): this {
        super.delete(key);
        super.set(key, value);
        return this;
    }

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

    public static override from<R, S>(iterable: Iterable<[R, S]>): CacheMap<R, S> {
        return new CacheMap(iterable);
    }

    public static override of<R, S>(...items: [R, S][]): CacheMap<R, S> {
        return new CacheMap(items);
    }
}

class TreeNode<K, V> {
    public entries: [K, V][] = [];
    public children: TreeNode<K, V>[] = [];
    public isLeaf: boolean = true;
}

export class TreeMap<K, V> extends SortedMap<K, V> {
    #size: number = 0;
    #root: TreeNode<K, V>;
    #compareFn: Comparator<K>;
    readonly #M = 4;

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
                return Optional.some(current.entries[i][1]);
            }

            current = current.isLeaf ? undefined : current.children[i];
        }
        return Optional.none();
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
        if (this.#size === 0) return Optional.none();
        let current = this.#root;
        while (!current.isLeaf) {
            current = current.children[0];
        }
        return Optional.some(current.entries[0][0]);
    }

    public last(): Optional<K> {
        if (this.#size === 0) return Optional.none();
        let current = this.#root;
        while (!current.isLeaf) {
            current = current.children[current.children.length - 1];
        }
        return Optional.some(current.entries[current.entries.length - 1][0]);
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

    public keys(): Stream<K> {
        return Stream.from(this).map(([key]) => key);
    }

    public values(): Stream<V> {
        return Stream.from(this).map(([_, value]) => value);
    }

    public entries(): Stream<[K, V]> {
        return Stream.from(this);
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

    public static from<R, S>(compareFn: Comparator<R>, iterable: Iterable<[R, S]>): TreeMap<R, S> {
        return new TreeMap(compareFn, iterable);
    }

    public static of<R, S>(compareFn: Comparator<R>, ...items: [R, S][]): TreeMap<R, S> {
        return new TreeMap(compareFn, items);
    }
}