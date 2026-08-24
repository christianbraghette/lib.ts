import { Deque, List, SortedList, SortedQueue, Stack, Collection } from "./collections";
import { Comparator, TriConsumer, TriFunctional } from "./functional";
import { Stream } from "./stream";
import { Optional } from "./optional";

export class ArrayList<T> extends List<T> implements Deque<T>, Stack<T> {
    #data: T[];

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
            return Optional.some(this.#data.pop()!);
        return Optional.none();

    }

    public remove(): Optional<T> {
        if (this.#data.length > 0)
            return Optional.some(this.#data.shift()!);
        return Optional.none();

    }

    public addFirst(...items: T[]): number {
        return this.#data.unshift(...items);
    }

    public clear(): void {
        this.#data.length = 0;
    }

    public first(): Optional<T> {
        if (this.#data.length > 0)
            return Optional.some(this.#data[0]!);
        return Optional.none();

    }

    public last(): Optional<T> {
        if (this.#data.length > 0)
            return Optional.some(this.#data[this.#data.length - 1]!);
        return Optional.none();

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
            return Optional.some(this.#data[index]!);
        return Optional.none();
    }

    public indexOf(searchElement: T, fromIndex: number = 0): number {
        return this.#data.indexOf(searchElement, fromIndex);
    }

    public lastIndexOf(searchElement: T, fromIndex: number = 0): number {
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

    public stream(): Stream<T> {
        return new Stream(() => this);
    }

    [Symbol.iterator](): IterableIterator<T> {
        return this.#data.values();
    }

    get [Symbol.toStringTag](): string { return "ArrayList"; };

    public static from<S>(iterable: Iterable<S>): ArrayList<S> {
        return new ArrayList(iterable);
    }

    public static of<S>(...items: S[]): ArrayList<S> {
        return new ArrayList(items);
    }
}

export class SortedArrayList<T> extends SortedList<T> implements SortedQueue<T> {
    #compareFn: Comparator<T>;
    #data: T[] = [];

    constructor(compareFn: Comparator<T>, iterable?: Iterable<T>) {
        super();
        this.#compareFn = compareFn;

        if (iterable)
            for (const item of iterable)
                this.add(item);
    }

    get size(): number {
        return this.#data.length;
    }

    public add(...items: T[]): number {
        let count = 0;

        for (const item of items) {
            let low = 0, high = this.#data.length;
            while (low < high) {
                let mid = (low + high) >>> 1;
                if (this.#compareFn(this.#data[mid], item) < 0)
                    low = mid + 1;
                else
                    high = mid;
            }
            this.#data.splice(low, 0, item);
            count++;
        }

        return count;
    }

    public removeLast(): Optional<T> {
        if (this.#data.length > 0)
            return Optional.some(this.#data.pop()!);
        return Optional.none();
    }

    public remove(): Optional<T> {
        if (this.#data.length > 0)
            return Optional.some(this.#data.shift()!);
        return Optional.none();
    }

    public clear(): void {
        this.#data.length = 0;
    }

    public first(): Optional<T> {
        if (this.#data.length > 0)
            return Optional.some(this.#data[0]!);
        return Optional.none();
    }

    public last(): Optional<T> {
        if (this.#data.length > 0)
            return Optional.some(this.#data[this.#data.length - 1]!);
        return Optional.none();
    }

    public has(...items: T[]): boolean {
        for (const item of items) {
            let low = 0, high = this.#data.length;
            while (low < high) {
                let mid = (low + high) >>> 1;
                if (this.#compareFn(this.#data[mid], item) < 0)
                    low = mid + 1;
                else
                    high = mid;
            }
            if (this.#data[low] !== item)
                return false;
        }
        return items.length > 0;
    }

    public delete(...items: T[]): number {
        const length = this.#data.length;
        for (const item of items) {
            let low = 0, high = this.#data.length;
            while (low < high) {
                let mid = (low + high) >>> 1;
                if (this.#compareFn(this.#data[mid], item) < 0)
                    low = mid + 1;
                else
                    high = mid;
            }
            if (this.#data[low] === item)
                this.#data.splice(low, 1);
        }
        return length - this.#data.length;
    }

    public get(index: number): Optional<T> {
        if (index < this.#data.length && index >= 0)
            return Optional.some(this.#data[index]!);
        return Optional.none();
    }

    public indexOf(searchElement: T, fromIndex: number = 0): number {
        let low = Math.max(0, fromIndex), high = this.#data.length;
        while (low < high) {
            let mid = (low + high) >>> 1;
            if (this.#compareFn(this.#data[mid], searchElement) < 0)
                low = mid + 1;
            else
                high = mid;
        }

        if (low < this.#data.length && this.#compareFn(this.#data[low], searchElement) === 0 && this.#data[low] === searchElement)
            return low;
        return -1;
    }

    public lastIndexOf(searchElement: T, fromIndex: number = this.#data.length - 1): number {
        if (this.#data.length === 0 || fromIndex < 0) return -1;
        
        let low = 0, high = Math.min(this.#data.length, fromIndex + 1);
        while (low < high) {
            let mid = (low + high) >>> 1;
            if (this.#compareFn(this.#data[mid], searchElement) <= 0)
                low = mid + 1;
            else
                high = mid;
        }
        
        const targetIndex = low - 1;
        if (targetIndex >= 0 && this.#compareFn(this.#data[targetIndex], searchElement) === 0 && this.#data[targetIndex] === searchElement)
            return targetIndex;
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

    public map<S>(fn: TriFunctional<T, number, this, S>): ArrayList<S> {
        const self = this;
        let i = 0;
        return new ArrayList(function* () {
            for (const item of self.iterator())
                yield fn(item, i++, self)
        }());
    }

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

    public stream(): Stream<T> {
        return new Stream(() => this);
    }

    [Symbol.iterator]() {
        return this.#data.values();
    }
}