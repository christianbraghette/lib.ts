/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Comparator, TriConsumer, TriFunctional } from "./functional";
import { FunctionalObject, IterableObject } from "./objects";
import { Optional } from "./optional";

/** Base class of every collection. All collections are iterable and can start a stream with `iterator()`. */
export abstract class Collection<T> extends IterableObject<T> implements FunctionalObject {
    /** The number of elements. */
    abstract readonly size: number;

    /**
     * Adds the given items.
     * @param items The items to add.
     * @returns How many items were actually added, which excludes duplicates in a set.
     */
    abstract add(...items: T[]): number;
    /**
     * Checks whether the collection contains the given items.
     * @param items The items to look for.
     * @returns `true` when every item is present, and `false` when called with no items.
     */
    abstract has(...items: T[]): boolean;
    /**
     * Removes the given items. A list removes the first occurrence for each argument.
     * @param items The items to remove.
     * @returns How many items were actually removed.
     */
    abstract delete(...items: T[]): number;
    /**
     * Calls a function for each element in iteration order.
     * @param consumer Receives the element, its index and this collection.
     */
    abstract forEach(consumer: TriConsumer<T, number, this>): void;
    /** Removes every element. */
    abstract clear(): void;

    /**
     * Builds a new collection from the result of calling a function on each element.
     * @param fn Receives the element, its index and this collection.
     * @returns A new collection, populated immediately.
     */
    abstract map<S>(fn: TriFunctional<T, number, this, S>): Collection<S>;
    /**
     * Like `map`, but a returned Collection is flattened into the result.
     * @param fn Returns either a single value or a Collection of values.
     * @returns A new collection, populated immediately.
     */
    abstract flatMap<S>(fn: TriFunctional<T, number, this, S | Collection<S>>): Collection<S>;
    
    /** Copies the elements into a new array, in iteration order. */
    public toArray(): T[] {
        return Array.from(this);
    }

    abstract [Symbol.iterator](): IterableIterator<T>;
}

/** An ordered collection with access by position. */
export abstract class List<T> extends Collection<T> {
    /**
     * Reads the element at a position.
     * @param index A zero-based position. Negative positions are out of range.
     * @returns The element, or None when the position is out of range.
     */
    abstract get(index: number): Optional<T>;
    /**
     * Replaces the element at a position.
     * @param index A zero-based position. A negative position counts from the end.
     * @param item The new element.
     * @returns `false` when the position is out of range, otherwise `true`.
     */
    abstract set(index: number, item: T): boolean;
    /**
     * Finds the first position of an item, compared with `===`.
     * @param item The item to find.
     * @param fromIndex The position to start searching from. Defaults to 0.
     * @returns The position, or -1 when the item is not found.
     */
    abstract indexOf(item: T, fromIndex?: number): number;
    /**
     * Finds the last position of an item, compared with `===`.
     * @param item The item to find.
     * @param fromIndex The position to search backwards from. Defaults to the last element.
     * @returns The position, or -1 when the item is not found.
     */
    abstract lastIndexOf(item: T, fromIndex?: number): number;
    /**
     * Copies a range of elements into a new list.
     * @param start The first position to include. Defaults to 0.
     * @param end The position to stop before. Defaults to the end of the list.
     */
    abstract slice(start?: number, end?: number): List<T>;
    /**
     * Removes a range of elements and optionally inserts new ones in its place.
     * @param start The position to start at.
     * @param deleteCount How many elements to remove.
     * @param items The elements to insert.
     * @returns A new list holding the removed elements.
     */
    abstract splice(start: number, deleteCount: number, ...items: T[]): List<T>;
    /**
     * Sorts this list in place.
     * @param comparator Defines the order.
     * @returns This list, for chaining.
     */
    abstract sort(comparator: Comparator<T>): this;
    /**
     * Copies this list into a new sorted list and leaves this list unchanged.
     * @param comparator Defines the order.
     */
    abstract toSorted(comparator: Comparator<T>): SortedList<T>;
}

/** A list kept in comparator order. Duplicates are allowed. */
export abstract class SortedList<T> extends Collection<T> {
    /**
     * Reads the element at a position.
     * @param index A zero-based position. Negative positions are out of range.
     * @returns The element, or None when the position is out of range.
     */
    abstract get(index: number): Optional<T>;
    /**
     * Finds the first position of an item, compared with `===`.
     * @param item The item to find.
     * @param fromIndex The position to start searching from. Defaults to 0.
     * @returns The position, or -1 when the item is not found.
     */
    abstract indexOf(item: T, fromIndex?: number): number;
    /**
     * Finds the last position of an item, compared with `===`.
     * @param item The item to find.
     * @param fromIndex The position to search backwards from. Defaults to the last element.
     * @returns The position, or -1 when the item is not found.
     */
    abstract lastIndexOf(item: T, fromIndex?: number): number;
    /**
     * Reads the lowest element without removing it.
     * @returns The element, or None when the list is empty.
     */
    abstract first(): Optional<T>;
    /**
     * Reads the highest element without removing it.
     * @returns The element, or None when the list is empty.
     */
    abstract last(): Optional<T>;
    /** Returns the comparator that defines this list's order. */
    abstract comparator(): Comparator<T>;
    /**
     * Copies the elements before a position into a new sorted list.
     * @param index The position to stop before.
     */
    abstract head(index: number): SortedList<T>;
    /**
     * Copies the elements from a position onwards into a new sorted list.
     * @param index The first position to include.
     */
    abstract tail(index: number): SortedList<T>;
    /**
     * Copies a range of elements into a new sorted list.
     * @param start The first position to include. Defaults to 0.
     * @param end The position to stop before. Defaults to the end of the list.
     */
    abstract slice(start?: number, end?: number): SortedList<T>;
    /** Copies the elements, still in their current order, into a new unsorted list. */
    abstract toUnsorted(): List<T>;
}

/** A collection that hands out elements from its front. */
export interface Queue<T> extends Collection<T> {
    /**
     * Reads the front element without removing it.
     * @returns The element, or None when the queue is empty.
     */
    first(): Optional<T>;
    /**
     * Removes the front element.
     * @returns The removed element, or None when the queue is empty.
     */
    remove(): Optional<T>;
}

/** A queue whose front is always the lowest element according to its comparator. */
export interface SortedQueue<T> extends Queue<T> {}

/** A queue that can also add and remove at its back. */
export interface Deque<T> extends Queue<T> {
    /**
     * Reads the back element without removing it.
     * @returns The element, or None when the deque is empty.
     */
    last(): Optional<T>;
    /**
     * Adds items at the front, keeping their argument order.
     * @param items The items to add.
     * @returns How many items were added.
     */
    addFirst(...items: T[]): number;
    /**
     * Removes the back element.
     * @returns The removed element, or None when the deque is empty.
     */
    removeLast(): Optional<T>;
}

/** A last-in, first-out collection. `add` pushes, `removeLast` pops and `last` peeks. */
export interface Stack<T> extends Collection<T> {
    /**
     * Reads the top element without removing it.
     * @returns The element, or None when the stack is empty.
     */
    last(): Optional<T>;
    /**
     * Removes the top element.
     * @returns The removed element, or None when the stack is empty.
     */
    removeLast(): Optional<T>;
}

/** A collection without duplicates. Importing this name shadows the native `Set` in that file. */
export abstract class Set<T> extends Collection<T> {
    /** Builds a new set with the elements of both sets. */
    abstract union(other: Set<T>): Set<T>;
    /** Builds a new set with the elements present in both sets. */
    abstract intersection(other: Set<T>): Set<T>;
    /** Builds a new set with the elements of this set that are not in `other`. */
    abstract difference(other: Set<T>): Set<T>
    /** Checks whether every element of this set is also in `other`. */
    abstract isSubsetOf(other: Set<T>): boolean;
}

/** A set kept in comparator order. */
export abstract class SortedSet<T> extends Set<T> {
    /**
     * Reads the lowest element.
     * @returns The element, or None when the set is empty.
     */
    abstract first(): Optional<T>;
    /**
     * Reads the highest element.
     * @returns The element, or None when the set is empty.
     */
    abstract last(): Optional<T>;
    /** Returns the comparator that defines this set's order. */
    abstract comparator(): Comparator<T>;
    /**
     * Copies the elements lower than `item` into a new set.
     * @param item The exclusive upper bound.
     */
    abstract head(item: T): SortedSet<T>;
    /**
     * Copies the elements equal to or higher than `item` into a new set.
     * @param item The inclusive lower bound.
     */
    abstract tail(item: T): SortedSet<T>;
    /**
     * Copies a range of elements into a new set.
     * @param fromKey The inclusive lower bound.
     * @param toKey The exclusive upper bound.
     */
    abstract slice(fromKey: T, toKey: T): SortedSet<T>;
}

export * from "./list";
export * from "./queue";
export * from "./set";

import "./stream";