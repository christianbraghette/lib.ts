import { Comparator, Supplier, TriConsumer, TriFunctional } from "./functional";
import { FunctionalObject, IterableObject } from "./objects";
import { Optional } from "./optional";
import { Stream } from "./stream";

export abstract class Collection<T> extends IterableObject<T> implements FunctionalObject {
    abstract readonly size: number;

    abstract add(...items: T[]): number;
    abstract has(...items: T[]): boolean;
    abstract delete(...items: T[]): number;
    abstract forEach(consumer: TriConsumer<T, number, this>): void;
    abstract clear(): void;

    abstract map<S>(fn: TriFunctional<T, number, this, S>): Collection<S>;
    abstract flatMap<S>(fn: TriFunctional<T, number, this, S | Collection<S>>): Collection<S>;
    
    public toArray(): T[] {
        return Array.from(this);
    }

    abstract stream(): Stream<T>;

    abstract [Symbol.iterator](): IterableIterator<T>;
}

export abstract class List<T> extends Collection<T> {
    abstract get(index: number): Optional<T>;
    abstract set(index: number, item: T): boolean;
    abstract indexOf(item: T, fromIndex?: number): number;
    abstract lastIndexOf(item: T, fromIndex?: number): number;
    abstract slice(start?: number, end?: number): List<T>;
    abstract splice(start: number, deleteCount: number, ...items: T[]): List<T>;
    abstract sort(comparator: Comparator<T>): this;
    abstract toSorted(comparator: Comparator<T>): SortedList<T>;
}

export abstract class SortedList<T> extends Collection<T> {
    abstract get(index: number): Optional<T>;
    abstract indexOf(item: T, fromIndex?: number): number;
    abstract lastIndexOf(item: T, fromIndex?: number): number;
    abstract first(): Optional<T>;
    abstract last(): Optional<T>;
    abstract comparator(): Comparator<T>;
    abstract head(index: number): SortedList<T>;
    abstract tail(index: number): SortedList<T>;
    abstract slice(start?: number, end?: number): SortedList<T>;
    abstract toUnsorted(): List<T>;
}

export interface Queue<T> extends Collection<T> {
    first(): Optional<T>;
    remove(): Optional<T>;
}

export interface SortedQueue<T> extends Queue<T> {}

export interface Deque<T> extends Queue<T> {
    last(): Optional<T>;
    addFirst(...items: T[]): number;
    removeLast(): Optional<T>;
}

export interface Stack<T> extends Collection<T> {
    last(): Optional<T>;
    removeLast(): Optional<T>;
}

export abstract class Set<T> extends Collection<T> {
    abstract union(other: Set<T>): Set<T>;
    abstract intersection(other: Set<T>): Set<T>;
    abstract difference(other: Set<T>): Set<T>
    abstract isSubsetOf(other: Set<T>): boolean;
}

export abstract class SortedSet<T> extends Set<T> {
    abstract first(): Optional<T>;
    abstract last(): Optional<T>;
    abstract comparator(): Comparator<T>;
    abstract head(item: T): SortedSet<T>;
    abstract tail(item: T): SortedSet<T>;
    abstract slice(fromKey: T, toKey: T): SortedSet<T>;
}

export * from "./list";
export * from "./queue";
export * from "./set";