import { Set, SortedSet, Collection } from "./collections";
import { Comparator, TriConsumer, TriFunctional } from "./functional";
import { Optional } from "./optional";
import { Stream } from "./stream";
import { NativeSet } from "./native";
import { ArrayList } from "./list";

export class HashSet<T> extends Set<T> {
    #set: NativeSet<T>;

    constructor(iterable?: Iterable<T>) {
        super();
        this.#set = new NativeSet(iterable);
    }

    public get size(): number {
        return this.#set.size;
    }

    public add(...items: T[]): number {
        const size = this.#set.size;
        for (const value of items)
            this.#set.add(value);
        return this.#set.size - size;
    }

    public has(...items: T[]): boolean {
        if (items.length === 0) return false;
        for (const item of items)
            if (!this.#set.has(item))
                return false;
        return true;
    }

    public delete(...items: T[]): number {
        const size = this.#set.size;
        for (const item of items)
            this.#set.delete(item);
        return size - this.#set.size;
    }

    public clear(): void {
        this.#set.clear();
    }

    public forEach(callbackfn: (value: T, index: number, obj: this) => void): void {
        let i = 0;
        for (const value of this.#set) {
            callbackfn(value, i++, this);
        }
    }

    public map<S>(fn: TriFunctional<T, number, this, S>): HashSet<S> {
        const self = this;
        return new HashSet(function* () {
            let i = 0;
            for (const value of self)
                yield fn(value, i++, self);
        }());
    }

    public flatMap<S>(fn: TriFunctional<T, number, this, S | Collection<S>>): HashSet<S> {
        const self = this;
        return new HashSet(function* () {
            let i = 0;
            for (const value of self.iterator()) {
                const result = fn(value, i++, self);
                if (result instanceof Collection)
                    yield* result.iterator();
                else
                    yield result;
            }
        }());
    }

    public union(other: Set<T>): HashSet<T> {
        const result = new HashSet<T>(this);
        for (const item of other) result.add(item);
        return result;
    }

    public intersection(other: Set<T>): HashSet<T> {
        const result = new HashSet<T>();
        for (const item of this)
            if (other.has(item)) result.add(item);
        return result;
    }

    public difference(other: Set<T>): HashSet<T> {
        const result = new HashSet<T>();
        for (const item of this)
            if (!other.has(item)) result.add(item);
        return result;
    }

    public isSubsetOf(other: Set<T>): boolean {
        if (this.size > other.size) return false;
        return this.stream().every(value => other.has(value));
    }

    public stream(): Stream<T> {
        return new Stream(() => this);
    };

    public get [Symbol.toStringTag](): string { return "HashSet"; }

    [Symbol.iterator](): IterableIterator<T> {
        return this.#set.values();
    }

    public static from<S>(iterable: Iterable<S>): HashSet<S> {
        return new HashSet(iterable);
    }

    public static of<S>(...items: S[]): HashSet<S> {
        return new HashSet(items);
    }
}

export class CacheSet<T> extends HashSet<T> {

    public override add(...items: T[]): number {
        const size = this.size;
        for (const item of items) {
            super.delete(item);
            super.add(item);
        }
        return this.size - size;
    }

    public override map<S>(fn: TriFunctional<T, number, this, S>): CacheSet<S> {
        const self = this;
        return new CacheSet(function* () {
            let i = 0;
            for (const item of self.iterator())
                yield fn(item, i++, self);
        }())
    }

    public override flatMap<S>(fn: TriFunctional<T, number, this, S | Collection<S>>): CacheSet<S> {
        const self = this;
        return new CacheSet(function* () {
            let i = 0;
            for (const item of self.iterator()) {
                const result = fn(item, i++, self);
                if (result instanceof Set)
                    yield* result.iterator();
                else
                    yield result;
            }
        }())
    }

    public override get [Symbol.toStringTag](): string { return "CacheSet"; }

    public static override from<S>(iterable: Iterable<S>): CacheSet<S> {
        return new CacheSet(iterable);
    }

    public static override of<S>(...items: S[]): CacheSet<S> {
        return new CacheSet(items);
    }
}

class TreeNode<T> {
    public elements: T[] = [];
    public children: TreeNode<T>[] = [];
    public isLeaf: boolean = true;
}

export class TreeSet<T> extends SortedSet<T> {
    #size: number = 0;
    #root: TreeNode<T>;
    #compareFn: Comparator<T>;
    readonly #M = 4

    constructor(compareFn: Comparator<T>, iterable?: Iterable<T>) {
        super();
        this.#compareFn = compareFn;
        this.#root = new TreeNode();
        for (const data of iterable ?? []) {
            this.add(data);
        }
    }

    public get size(): number {
        return this.#size;
    }

    public add(...items: T[]): number {
        const initialSize = this.#size;

        for (const value of items) {
            const root = this.#root;

            if (root.elements.length === this.#M - 1) {
                const newRoot = new TreeNode<T>();
                newRoot.isLeaf = false;
                newRoot.children.push(root);
                this.#root = newRoot;
                this.#splitChild(newRoot, 0, root);
            }

            this.#insertNonFull(this.#root, value);
        }

        return this.#size - initialSize;
    }

    #insertNonFull(node: TreeNode<T>, value: T): void {
        let i = node.elements.length - 1;

        if (node.isLeaf) {
            while (i >= 0 && this.#compareFn(value, node.elements[i]) < 0) {
                i--;
            }

            if (i >= 0 && this.#compareFn(value, node.elements[i]) === 0) {
                return;
            }

            node.elements.splice(i + 1, 0, value);
            this.#size++;
        } else {
            while (i >= 0 && this.#compareFn(value, node.elements[i]) < 0) {
                i--;
            }

            if (i >= 0 && this.#compareFn(value, node.elements[i]) === 0) {
                return;
            }

            i++;
            if (node.children[i].elements.length === this.#M - 1) {
                this.#splitChild(node, i, node.children[i]);
                if (this.#compareFn(value, node.elements[i]) > 0) {
                    i++;
                }
            }
            this.#insertNonFull(node.children[i], value);
        }
    }

    #splitChild(parent: TreeNode<T>, index: number, child: TreeNode<T>): void {
        const newChild = new TreeNode<T>();
        newChild.isLeaf = child.isLeaf;

        const medianIndex = 1;
        const promotedElement = child.elements[medianIndex];

        newChild.elements = child.elements.splice(medianIndex + 1);
        child.elements.pop();

        if (!child.isLeaf) {
            newChild.children = child.children.splice(medianIndex + 1);
        }

        parent.elements.splice(index, 0, promotedElement);
        parent.children.splice(index + 1, 0, newChild);
    }

    public has(...items: T[]): boolean {
        if (items.length === 0) return false;

        for (const item of items) {
            let current: TreeNode<T> | undefined = this.#root;
            let found = false;

            while (current) {
                let i = 0;
                const len = current.elements.length;
                while (i < len && this.#compareFn(item, current.elements[i]) > 0) {
                    i++;
                }

                if (i < len && this.#compareFn(item, current.elements[i]) === 0) {
                    found = true;
                    break;
                }

                current = current.isLeaf ? undefined : current.children[i];
            }
            if (!found) return false;
        }
        return true;
    }

    public delete(...items: T[]): number {
        const initialSize = this.#size;

        for (const value of items) {
            if (this.#size === 0) continue;

            this.#deleteTopDown(this.#root, value);

            if (this.#root.elements.length === 0 && !this.#root.isLeaf) {
                this.#root = this.#root.children[0];
            }
        }

        return initialSize - this.#size;
    }

    #deleteTopDown(node: TreeNode<T>, value: T): void {
        let i = 0;
        const len = node.elements.length;
        while (i < len && this.#compareFn(value, node.elements[i]) > 0) {
            i++;
        }

        if (i < len && this.#compareFn(value, node.elements[i]) === 0) {
            if (node.isLeaf) {
                node.elements.splice(i, 1);
                this.#size--;
            } else {
                const leftChild = node.children[i];
                const rightChild = node.children[i + 1];

                if (leftChild.elements.length > 1) {
                    const pred = this.#getExtreme(leftChild, "last");
                    node.elements[i] = pred;
                    this.#deleteTopDown(leftChild, pred);
                } else if (rightChild.elements.length > 1) {
                    const succ = this.#getExtreme(rightChild, "first");
                    node.elements[i] = succ;
                    this.#deleteTopDown(rightChild, succ);
                } else {
                    this.#mergeChildren(node, i);
                    this.#deleteTopDown(leftChild, value);
                }
            }
        } else {
            if (node.isLeaf) return;

            const child = node.children[i];

            if (child.elements.length === 1) {
                const leftSibling = i > 0 ? node.children[i - 1] : undefined;
                const rightSibling = i < node.children.length - 1 ? node.children[i + 1] : undefined;

                if (leftSibling && leftSibling.elements.length > 1) {
                    child.elements.unshift(node.elements[i - 1]);
                    node.elements[i - 1] = leftSibling.elements.pop()!;
                    if (!child.isLeaf) {
                        child.children.unshift(leftSibling.children.pop()!);
                    }
                } else if (rightSibling && rightSibling.elements.length > 1) {
                    child.elements.push(node.elements[i]);
                    node.elements[i] = rightSibling.elements.shift()!;
                    if (!child.isLeaf) {
                        child.children.push(rightSibling.children.shift()!);
                    }
                } else {
                    if (leftSibling) {
                        this.#mergeChildren(node, i - 1);
                        this.#deleteTopDown(node.children[i - 1], value);
                        return;
                    } else {
                        this.#mergeChildren(node, i);
                    }
                }
            }
            this.#deleteTopDown(node.children[i], value);
        }
    }

    #mergeChildren(parent: TreeNode<T>, index: number): void {
        const left = parent.children[index];
        const right = parent.children[index + 1];
        const promoted = parent.elements.splice(index, 1)[0];
        parent.children.splice(index + 1, 1);

        left.elements.push(promoted, ...right.elements);

        if (!left.isLeaf) {
            left.children.push(...right.children);
        }
    }

    #getExtreme(node: TreeNode<T>, side: "first" | "last"): T {
        let current = node;
        while (!current.isLeaf) {
            current = current.children[side === "first" ? 0 : current.children.length - 1];
        }
        return current.elements[side === "first" ? 0 : current.elements.length - 1];
    }

    public first(): Optional<T> {
        if (this.#size === 0) return Optional.none();
        let current = this.#root;
        while (!current.isLeaf) {
            current = current.children[0];
        }
        return Optional.some(current.elements[0]);
    }

    public last(): Optional<T> {
        if (this.#size === 0) return Optional.none();
        let current = this.#root;
        while (!current.isLeaf) {
            current = current.children[current.children.length - 1];
        }
        return Optional.some(current.elements[current.elements.length - 1]);
    }

    public clear(): void {
        this.#root = new TreeNode<T>();
        this.#size = 0;
    }

    public comparator(): Comparator<T> {
        return this.#compareFn;
    }

    public head(item: T): TreeSet<T> {
        return this.#createSubSet(undefined, item);
    }

    public tail(item: T): TreeSet<T> {
        return this.#createSubSet(item, undefined);
    }

    public slice(fromItem: T, toItem: T): TreeSet<T> {
        if (this.#compareFn(fromItem, toItem) > 0)
            return new TreeSet(this.#compareFn);
        return this.#createSubSet(fromItem, toItem);
    }

    #createSubSet(fromItem?: T, toItem?: T): TreeSet<T> {
        const subSet = new TreeSet<T>(this.#compareFn);
        for (const value of this) {
            if (fromItem !== undefined && this.#compareFn(value, fromItem) < 0) continue;
            if (toItem !== undefined && this.#compareFn(value, toItem) >= 0) continue;
            subSet.add(value);
        }
        return subSet;
    }

    public union(other: Set<T>): TreeSet<T> {
        const result = new TreeSet<T>(this.#compareFn, this);
        for (const item of other) result.add(item);
        return result;
    }

    public intersection(other: Set<T>): TreeSet<T> {
        const result = new TreeSet<T>(this.#compareFn);
        for (const item of this) { if (other.has(item)) result.add(item); }
        return result;
    }

    public difference(other: Set<T>): TreeSet<T> {
        const result = new TreeSet<T>(this.#compareFn);
        for (const item of this) { if (!other.has(item)) result.add(item); }
        return result;
    }

    public isSubsetOf(other: Set<T>): boolean {
        if (this.size > other.size)
            return false;

        for (const item of this)
            if (!other.has(item))
                return false;

        return true;
    }

    public forEach(consumer: TriConsumer<T, number, this>): void {
        let index = 0;
        for (const item of this)
            consumer(item, index++, this);
    }

    public map<S>(fn: TriFunctional<T, number, this, S>): Collection<S> {
        const self = this;
        return new ArrayList<S>(function* () {
            let index = 0;
            for (const item of self.iterator())
                yield fn(item, index++, self);
        }());
    }

    public flatMap<S>(fn: TriFunctional<T, number, this, S | Collection<S>>): Collection<S> {
        const self = this;
        return new ArrayList<S>(function* () {
            let index = 0;
            for (const item of self.iterator()) {
                const value = fn(item, index++, self);
                if (value instanceof Collection)
                    yield* value;
                else
                    yield value;
            }
        }());
    }

    public stream(): Stream<T> {
        return new Stream(() => this);
    }

    public *[Symbol.iterator](): IterableIterator<T> {
        const stack: { node: TreeNode<T>; index: number }[] = [];
        let current: TreeNode<T> | undefined = this.#root;
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

                if (i < node.elements.length) {
                    yield node.elements[i];
                    stack.push({ node: node, index: i + 1 });
                    current = node.isLeaf ? undefined : node.children[i + 1];
                    idx = 0;
                }
            }
        }
    }

    public get [Symbol.toStringTag](): string { return "TreeSet"; }

    public static from<S>(compareFn: Comparator<S>, iterable: Iterable<S>): TreeSet<S> {
        return new TreeSet(compareFn, iterable);
    }

    public static of<S>(compareFn: Comparator<S>, ...items: S[]): TreeSet<S> {
        return new TreeSet(compareFn, items);
    }
}