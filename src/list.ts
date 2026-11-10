/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Deque, List, SortedList, SortedQueue, Stack, Collection } from "./collections";
import { Comparator, TriConsumer, TriFunctional } from "./functional";
import { None, Optional, Some } from "./optional";

/**
 * An array-backed list that also works as a deque and a stack.
 * @example
 * const list = ArrayList.of(1, 2, 3);
 * list.add(4); // 1
 * list.first().orThrow(); // 1
 * list.removeLast().orThrow(); // 4
 * list.get(9).isNone(); // true
 */
export class ArrayList<T> extends List<T> implements Deque<T>, Stack<T> {
    #data: T[];

    /**
     * Creates a list.
     * @param iterable The initial elements. Defaults to an empty list.
     */
    constructor(iterable?: Iterable<T>) {
        super();
        this.#data = iterable ? Array.from(iterable) : [];
    }

    get size(): number {
        return this.#data.length;
    }

    public add(...items: T[]): number {
        const length = this.#data.length;
        return this.#data.push(...items) - length;
    }

    public removeLast(): Optional<T> {
        if (this.#data.length > 0)
            return Some.of(this.#data.pop()! as T);
        return None.of();

    }

    public remove(): Optional<T> {
        if (this.#data.length > 0)
            return Some.of(this.#data.shift()! as T);
        return None.of();

    }

    public addFirst(...items: T[]): number {
        this.#data.unshift(...items);
        return items.length;
    }

    public clear(): void {
        this.#data.length = 0;
    }

    public first(): Optional<T> {
        if (this.#data.length > 0)
            return Some.of(this.#data[0]);
        return None.of();

    }

    public last(): Optional<T> {
        if (this.#data.length > 0)
            return Some.of(this.#data[this.#data.length - 1]);
        return None.of();

    }

    public has(...items: T[]): boolean {
        return items.length > 0 && items.every(item => this.#data.includes(item));
    }

    public delete(...items: T[]): number {
        const length = this.#data.length;
        for (const item of items) {
            const index = this.#data.indexOf(item);
            if (index === -1)
                continue;
            this.#data.splice(index, 1);
        }
        return length - this.#data.length;
    }

    public get(index: number): Optional<T> {
        if (index < this.#data.length && index >= 0)
            return Some.of(this.#data[index]);
        return None.of();
    }

    public indexOf(searchElement: T, fromIndex: number = 0): number {
        return this.#data.indexOf(searchElement, fromIndex);
    }

    public lastIndexOf(searchElement: T, fromIndex: number = this.#data.length - 1): number {
        return this.#data.lastIndexOf(searchElement, fromIndex);
    }

    public slice(start?: number, end?: number): ArrayList<T> {
        return new ArrayList<T>(this.#data.slice(start, end));
    }

    public splice(start: number, deleteCount: number, ...items: T[]): ArrayList<T> {
        return new ArrayList<T>(this.#data.splice(start, deleteCount, ...items));
    }

    public sort(comparator: Comparator<T>): this {
        this.#data.sort(comparator);
        return this;
    }

    public set(index: number, item: T): boolean {
        let target = index < 0 ? this.size + index : index;
        if (target < 0 || target >= this.size)
            return false;
        this.#data[target] = item;
        return true;
    }

    public forEach(callbackfn: (value: T, key: number, obj: this) => void): void {
        this.#data.forEach((v: T, i: number) => callbackfn(v, i, this));
    }

    public map<S>(fn: TriFunctional<T, number, this, S>): ArrayList<S> {
        const self = this;
        return new ArrayList(function* () {
            let i = 0;
            for (const value of self)
                yield fn(value, i++, self);
        }())
    }

    public flatMap<S>(fn: TriFunctional<T, number, this, S | Collection<S>>): ArrayList<S> {
        const self = this;
        return new ArrayList(function* () {
            let i = 0;
            for (const value of self.iterator()) {
                const result = fn(value, i++, self);
                if (result instanceof Collection)
                    yield* result.iterator();
                else
                    yield result;
            }
        }())
    }

    public toSorted(comparator: Comparator<T>): SortedArrayList<T> {
        return new SortedArrayList(comparator, this);
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this.#data.values();
    }

    get [Symbol.toStringTag](): string { return "ArrayList"; };

    /**
     * Creates a list from an iterable. Can be passed directly to `stream.collect`.
     * @param iterable The initial elements.
     */
    public static from<S>(iterable: Iterable<S>): ArrayList<S> {
        return new ArrayList(iterable);
    }

    /**
     * Creates a list from its arguments.
     * @param items The initial elements.
     */
    public static of<S>(...items: S[]): ArrayList<S> {
        return new ArrayList(items);
    }
}

/**
 * An array-backed list kept in comparator order. Elements the comparator treats as equal keep their insertion order.
 * @example
 * const list = new SortedArrayList(Comparator.natural<number>(), [3, 1, 2]);
 * list.add(0); // 1
 * list.toArray(); // [0, 1, 2, 3]
 */
export class SortedArrayList<T> extends SortedList<T> implements SortedQueue<T> {
    #compareFn: Comparator<T>;
    #data: T[] = [];

    /**
     * Creates a sorted list.
     * @param compareFn Defines the order.
     * @param iterable The initial elements. Defaults to an empty list.
     */
    constructor(compareFn: Comparator<T>, iterable?: Iterable<T>) {
        super();
        this.#compareFn = compareFn;

        if (iterable)
            this.#data = Array.from(iterable).sort(compareFn);
    }

    get size(): number {
        return this.#data.length;
    }

    /** First index in `[from, size]` whose element is not ordered before `item`. */
    #lowerBound(item: T, from: number = 0): number {
        let low = from, high = this.#data.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (this.#compareFn(this.#data[mid], item) < 0)
                low = mid + 1;
            else
                high = mid;
        }
        return low;
    }

    /** First index in `[0, to]` whose element is ordered after `item`. */
    #upperBound(item: T, to: number = this.#data.length): number {
        let low = 0, high = to;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (this.#compareFn(this.#data[mid], item) <= 0)
                low = mid + 1;
            else
                high = mid;
        }
        return low;
    }

    public add(...items: T[]): number {
        for (const item of items)
            this.#data.splice(this.#upperBound(item), 0, item);
        return items.length;
    }

    /**
     * Removes the highest element.
     * @returns The removed element, or None when the list is empty.
     */
    public removeLast(): Optional<T> {
        if (this.#data.length > 0)
            return Some.of(this.#data.pop()! as T);
        return None.of();
    }

    public remove(): Optional<T> {
        if (this.#data.length > 0)
            return Some.of(this.#data.shift()! as T);
        return None.of();
    }

    public clear(): void {
        this.#data.length = 0;
    }

    public first(): Optional<T> {
        if (this.#data.length > 0)
            return Some.of(this.#data[0]);
        return None.of();
    }

    public last(): Optional<T> {
        if (this.#data.length > 0)
            return Some.of(this.#data[this.#data.length - 1]);
        return None.of();
    }

    public has(...items: T[]): boolean {
        return items.length > 0 && items.every(item => this.indexOf(item) !== -1);
    }

    public delete(...items: T[]): number {
        const length = this.#data.length;
        for (const item of items) {
            const index = this.indexOf(item);
            if (index !== -1)
                this.#data.splice(index, 1);
        }
        return length - this.#data.length;
    }

    public get(index: number): Optional<T> {
        if (index < this.#data.length && index >= 0)
            return Some.of(this.#data[index]);
        return None.of();
    }

    public indexOf(searchElement: T, fromIndex: number = 0): number {
        // Elements the comparator treats as equal can still be different values, so scan the whole run.
        for (let i = this.#lowerBound(searchElement, Math.max(0, fromIndex)); i < this.#data.length; i++) {
            if (this.#compareFn(this.#data[i], searchElement) !== 0) break;
            if (this.#data[i] === searchElement) return i;
        }
        return -1;
    }

    public lastIndexOf(searchElement: T, fromIndex: number = this.#data.length - 1): number {
        if (fromIndex < 0) return -1;

        for (let i = this.#upperBound(searchElement, Math.min(this.#data.length, fromIndex + 1)) - 1; i >= 0; i--) {
            if (this.#compareFn(this.#data[i], searchElement) !== 0) break;
            if (this.#data[i] === searchElement) return i;
        }
        return -1;
    }

    public comparator(): Comparator<T> {
        return this.#compareFn;
    }

    public head(index: number): SortedArrayList<T> {
        return this.slice(0, index);

    }
    public tail(index: number): SortedArrayList<T> {
        return this.slice(index);
    }

    public slice(start?: number, end?: number): SortedArrayList<T> {
        return new SortedArrayList<T>(this.#compareFn, this.#data.slice(start, end));
    }

    public toUnsorted(): ArrayList<T> {
        return new ArrayList(this.iterator());
    };

    public forEach(consumer: TriConsumer<T, number, this>): void {
        let i = 0;
        for (const item of this.iterator())
            consumer(item, i++, this);
    };

    /**
     * Builds a new list from the result of calling a function on each element.
     * @param fn Receives the element, its index and this list.
     * @returns An unsorted ArrayList, because mapped values have no defined order.
     */
    public map<S>(fn: TriFunctional<T, number, this, S>): ArrayList<S> {
        const self = this;
        let i = 0;
        return new ArrayList(function* () {
            for (const item of self.iterator())
                yield fn(item, i++, self)
        }());
    }

    /**
     * Like `map`, but a returned Collection is flattened into the result.
     * @param fn Returns either a single value or a Collection of values.
     * @returns An unsorted ArrayList, because mapped values have no defined order.
     */
    public flatMap<S>(fn: TriFunctional<T, number, this, S | Collection<S>>): ArrayList<S> {
        const self = this;
        let i = 0;
        return new ArrayList(function* () {
            for (const item of self.iterator()) {
                const value = fn(item, i++, self);
                if (value instanceof Collection)
                    yield* value;
                else
                    yield value;
            }
        }());
    }

    [Symbol.iterator]() {
        return this.#data.values();
    }

    get [Symbol.toStringTag](): string { return "SortedArrayList"; }
}