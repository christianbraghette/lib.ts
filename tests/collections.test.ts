/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { ArrayList, CacheMap, CacheSet, Comparator, HashMap, HashSet, PriorityQueue, SortedArrayList, TreeMap, TreeSet } from "easylib.ts";

const natural = Comparator.natural<number>();

test("ArrayList works as a list, deque and stack", () => {
    const list = ArrayList.of(1, 2, 3);
    assert.equal(list.add(4, 5), 2);
    assert.equal(list.addFirst(-1, 0), 2);
    assert.deepEqual(list.toArray(), [-1, 0, 1, 2, 3, 4, 5]);
    assert.equal(list.remove().orThrow(), -1);
    assert.equal(list.removeLast().orThrow(), 5);
    assert.equal(list.get(99).isNone(), true);
    assert.equal(new ArrayList<number>().remove().isNone(), true);
    assert.equal(list.delete(0, 99), 1);
    assert.equal(list.has(), false);
    assert.equal(list.has(1, 2), true);
    assert.equal(list.has(1, 99), false);
});

test("ArrayList.lastIndexOf searches the whole list by default", () => {
    const list = ArrayList.of(1, 2, 1);
    assert.equal(list.lastIndexOf(1), 2);
    assert.equal(list.lastIndexOf(1, 1), 0);
    assert.equal(list.lastIndexOf(9), -1);
});

test("ArrayList.flatMap flattens collections and keeps plain values", () => {
    assert.deepEqual(ArrayList.of(1, 2).flatMap(n => n === 1 ? ArrayList.of(7, 8) : n).toArray(), [7, 8, 2]);
});

type Person = { name: string; age: number };
const byAge = Comparator.byProperty<Person, "age">("age", natural);

test("SortedArrayList stays sorted and keeps insertion order for equal elements", () => {
    const list = new SortedArrayList(natural, [3, 1, 2]);
    list.add(0, 5);
    assert.deepEqual(list.toArray(), [0, 1, 2, 3, 5]);

    const a = { name: "a", age: 1 }, b = { name: "b", age: 1 };
    assert.deepEqual(new SortedArrayList(byAge, [a, b]).toArray(), [a, b]);
    const added = new SortedArrayList(byAge);
    added.add(a, b);
    assert.deepEqual(added.toArray(), [a, b]);
});

test("SortedArrayList finds each of several comparator-equal elements", () => {
    const a = { name: "a", age: 1 }, b = { name: "b", age: 1 }, c = { name: "c", age: 1 };
    const list = new SortedArrayList(byAge, [a, b, c]);
    assert.equal(list.has(b, c), true);
    assert.equal(list.has({ name: "d", age: 1 }), false);
    assert.equal(list.indexOf(c), 2);
    assert.equal(list.lastIndexOf(a), 0);
    assert.equal(list.delete(b), 1);
    assert.deepEqual(list.toArray(), [a, c]);
});

test("PriorityQueue iterates in priority order without removing", () => {
    const queue = new PriorityQueue(natural, [5, 1, 4, 2, 3]);
    assert.deepEqual([...queue], [1, 2, 3, 4, 5]);
    assert.equal(queue.size, 5);
    assert.equal(queue.delete(3), 1);
    const drained: number[] = [];
    while (queue.size > 0) drained.push(queue.remove().orThrow());
    assert.deepEqual(drained, [1, 2, 4, 5]);
    assert.equal(queue.remove().isNone(), true);
});

test("HashSet set operations", () => {
    const a = HashSet.of(1, 2, 3), b = HashSet.of(2, 3, 4);
    assert.deepEqual(a.union(b).toArray(), [1, 2, 3, 4]);
    assert.deepEqual(a.intersection(b).toArray(), [2, 3]);
    assert.deepEqual(a.difference(b).toArray(), [1]);
    assert.equal(HashSet.of(2).isSubsetOf(a), true);
    assert.equal(a.add(3, 9), 1);
});

test("CacheSet moves re-added items to the end and flattens any collection", () => {
    const set = CacheSet.of("a", "b");
    assert.equal(set.add("a"), 0);
    assert.deepEqual(set.toArray(), ["b", "a"]);
    assert.deepEqual(CacheSet.of(1).flatMap(() => ArrayList.of(7, 8)).toArray(), [7, 8]);
});

test("HashMap and CacheMap", () => {
    const map = new HashMap<string, number>().set("a", 1);
    assert.equal(map.get("a").orThrow(), 1);
    assert.equal(map.get("b").isNone(), true);
    assert.equal(map.add(["a", 2], ["b", 3]), 1);
    assert.deepEqual(map.keys().toArray(), ["a", "b"]);
    assert.deepEqual([...map.map(v => v * 2)], [["a", 4], ["b", 6]]);

    const cache = CacheMap.of(["a", 1], ["b", 2]);
    cache.set("a", 3);
    assert.deepEqual([...cache], [["b", 2], ["a", 3]]);
});

function shuffled(count: number, seed: number): number[] {
    const values = Array.from({ length: count }, (_, i) => i);
    let state = seed;
    for (let i = values.length - 1; i > 0; i--) {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        const j = state % (i + 1);
        [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
}

test("TreeSet range queries", () => {
    const set = TreeSet.of(natural, 5, 1, 3, 9);
    assert.equal(set.first().orThrow(), 1);
    assert.equal(set.last().orThrow(), 9);
    assert.deepEqual(set.head(5).toArray(), [1, 3]);
    assert.deepEqual(set.tail(5).toArray(), [5, 9]);
    assert.deepEqual(set.slice(3, 9).toArray(), [3, 5]);
    assert.equal(new TreeSet(natural).first().isNone(), true);
});

test("TreeSet stays consistent through random inserts and deletes", () => {
    for (const seed of [1, 2, 3]) {
        const set = new TreeSet(natural, shuffled(500, seed));
        const expected = new globalThis.Set(shuffled(500, seed));
        for (const value of shuffled(500, seed + 10).slice(0, 350)) {
            assert.equal(set.delete(value), 1);
            expected.delete(value);
            assert.equal(set.has(value), false);
        }
        assert.equal(set.size, expected.size);
        assert.deepEqual(set.toArray(), [...expected].sort((a, b) => a - b));
    }
});

test("TreeMap range queries and overwrites", () => {
    const map = TreeMap.of(natural, [3, "c"], [1, "a"], [2, "b"]);
    assert.equal(map.add([2, "B"], [4, "d"]), 1);
    assert.deepEqual(map.values().toArray(), ["a", "B", "c", "d"]);
    assert.equal(map.first().orThrow(), 1);
    assert.equal(map.last().orThrow(), 4);
    assert.deepEqual([...map.head(2).keys()], [1]);
    assert.deepEqual([...map.tail(3).keys()], [3, 4]);
    assert.deepEqual([...map.slice(2, 4).keys()], [2, 3]);
});

test("TreeMap stays consistent through random inserts and deletes", () => {
    for (const seed of [4, 5, 6]) {
        const map = new TreeMap<number, number>(natural, shuffled(500, seed).map(v => [v, v * 2] as [number, number]));
        const removed = shuffled(500, seed + 10).slice(0, 350);
        assert.equal(map.delete(...removed), 350);
        const gone = new globalThis.Set(removed);
        const expected = shuffled(500, seed).filter(v => !gone.has(v)).sort((a, b) => a - b);
        assert.deepEqual(map.keys().toArray(), expected);
        for (const key of expected) assert.equal(map.get(key).orThrow(), key * 2);
        for (const key of removed) assert.equal(map.get(key).isNone(), true);
    }
});
