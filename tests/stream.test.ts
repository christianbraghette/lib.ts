/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { ArrayList, BinaryOperator, Collectors, Comparator, StreamIterator as S, UnaryOperator } from "easylib.ts";
import type { Stack } from "easylib.ts";

const natural = Comparator.natural<number>();

test("sources", () => {
    assert.deepEqual(S.of(1, 2).toArray(), [1, 2]);
    assert.deepEqual(S.from(new globalThis.Set([1, 2])).toArray(), [1, 2]);
    assert.deepEqual(S.fromObject({ x: 1 }).toArray(), [["x", 1]]);
    assert.deepEqual(S.concat([1], [2, 3]).toArray(), [1, 2, 3]);
    assert.deepEqual(S.join<number | string>([1, 2], ["a", "b", "c"]).toArray(), [[1, "a"], [2, "b"]]);
    assert.deepEqual(S.generate(() => 7).limit(2).toArray(), [7, 7]);
    assert.deepEqual(S.iterate(1, UnaryOperator.increment(2)).limit(3).toArray(), [1, 3, 5]);
});

test("slicing", () => {
    assert.deepEqual(S.of(1, 2, 3, 4).take(2, 1).toArray(), [2, 3]);
    assert.deepEqual(S.of(1, 2, 3).drop(1).toArray(), [2, 3]);
    assert.deepEqual(S.of(1, 2, 3).limit(0).toArray(), []);
    assert.deepEqual(S.of(1, 2, 3, 1).while(n => n < 3).toArray(), [1, 2]);
    assert.deepEqual(S.of(1, 2, 3, 1).until(n => n > 2).toArray(), [1, 2]);
    assert.deepEqual(S.of(1, 2, 3, 1).skip(n => n < 2).toArray(), [2, 3, 1]);
});

test("limit and take do not pull past the last value", () => {
    let pulled = 0;
    assert.deepEqual(S.generate(() => ++pulled).limit(2).toArray(), [1, 2]);
    assert.equal(pulled, 2);
    pulled = 0;
    S.generate(() => ++pulled).take(1, 2).toArray();
    assert.equal(pulled, 3);
});

test("pipelines are lazy", () => {
    let calls = 0;
    const stream = S.of(1, 2, 3).peek(() => calls++).map(n => n * 2);
    assert.equal(calls, 0);
    assert.deepEqual(stream.limit(1).toArray(), [2]);
    assert.equal(calls, 1);
});

test("transforming passes the index and flattens streams", () => {
    assert.deepEqual(S.of("a", "b").map((v, i) => `${v}${i}`).toArray(), ["a0", "b1"]);
    assert.deepEqual(S.of(1, 2).flatMap(n => S.of(n, n)).toArray(), [1, 1, 2, 2]);
    assert.deepEqual(S.of(1, 2, 3).filter(n => n !== 2).toArray(), [1, 3]);
});

test("cacheMap shares state across elements", () => {
    const fibonacci = (cache: Stack<number>, n: number) => {
        if (n < 2) {
            cache.add(n);
            return n;
        }
        const n1 = cache.removeLast().orThrow();
        const n2 = cache.removeLast().orThrow();
        cache.add(n2, n1, n1 + n2);
        return n1 + n2;
    };
    assert.deepEqual(
        S.iterate(0, UnaryOperator.increment()).cacheMap(fibonacci, new ArrayList<number>()).limit(8).toArray(),
        [0, 1, 1, 2, 3, 5, 8, 13],
    );
});

test("on runs the call, peek and return hooks", () => {
    const calls: string[] = [];
    S.of(1).on({ call: () => calls.push("call"), peek: v => calls.push(`peek${v}`), return: () => calls.push("return") }).drain();
    assert.deepEqual(calls, ["call", "peek1", "return"]);
});

test("sort is stable", () => {
    const items = [{ k: 1, v: "a" }, { k: 0, v: "b" }, { k: 1, v: "c" }, { k: 0, v: "d" }];
    const sorted = S.from(items).sort((x, y) => x.k - y.k).map(i => i.v).toArray();
    assert.deepEqual(sorted, ["b", "d", "a", "c"]);
});

test("reverse yields each element once, on every read", () => {
    const reversed = S.of(1, 2, 3).reverse();
    assert.deepEqual(reversed.toArray(), [3, 2, 1]);
    assert.deepEqual(reversed.toArray(), [3, 2, 1]);
});

test("distinct can be re-read from a one-shot source", () => {
    const distinct = S.from(function* () { yield 1; yield 1; yield 2; }()).distinct();
    assert.deepEqual(distinct.toArray(), [1, 2]);
    assert.deepEqual(distinct.toArray(), [1, 2]);
});

test("buffer pulls once and survives partial and interleaved reads", () => {
    let pulled = 0;
    const buffered = S.generate(() => ++pulled).limit(3).buffer();
    assert.deepEqual(buffered.limit(2).toArray(), [1, 2]);
    assert.deepEqual(buffered.toArray(), [1, 2, 3]);
    assert.deepEqual(buffered.toArray(), [1, 2, 3]);
    assert.equal(pulled, 3);

    const shared = S.of(1, 2, 3).buffer();
    const a = shared.sink(), b = shared.sink();
    assert.deepEqual([a.next().value, b.next().value, a.next().value, b.next().value], [1, 1, 2, 2]);
});

test("a stream can be consumed only once", () => {
    const stream = S.of(1, 2);
    stream.count();
    assert.equal(stream.locked, true);
    assert.throws(() => stream.count(), /Stream locked/);
});

test("collections hand out a new stream every time", () => {
    const list = ArrayList.of(1, 2);
    assert.equal(list.iterator().count(), 2);
    assert.equal(list.iterator().count(), 2);
});

test("terminal operations", () => {
    assert.equal(S.of(1, 2, 3).reduce(BinaryOperator.sum(), 0), 6);
    assert.equal(S.of(1, 2, 3).find(n => n > 1), 2);
    assert.equal(S.of(1, 2, 3).findLast(n => n < 3), 2);
    assert.equal(S.of(1).find(n => n > 1), undefined);
    assert.equal(S.of(1, 2).some(n => n > 1), true);
    assert.equal(S.of(1, 2).every(n => n > 1), false);
    assert.equal(S.of(2, 1, 3).min(natural), 1);
    assert.equal(S.of(2, 1, 3).max(natural), 3);
    assert.equal(S.of<number>().min(natural), undefined);
    assert.equal(S.of(1, 2).toString(), "1,2");
});

test("groupby", () => {
    const groups = S.of("apple", "avocado", "banana").groupby(w => w[0]);
    assert.deepEqual(groups.get("a").orThrow().toArray(), ["apple", "avocado"]);
    assert.equal(groups.get("z").isNone(), true);
});

test("tee gives each function the same data", () => {
    const results = S.of(1, 2, 3).tee(s => s.map(n => n * 2), s => s.filter(n => n > 1)).toArray();
    assert.deepEqual(results.map(s => s.toArray()), [[2, 4, 6], [2, 3]]);
});

test("Collectors build every collection type", () => {
    const pairs: [string, number][] = [["b", 2], ["a", 1]];
    const strings = Comparator.natural<string>();
    assert.deepEqual(S.of(2, 1).collect(Collectors.ArrayList()).toArray(), [2, 1]);
    assert.deepEqual(S.of(2, 1).collect(Collectors.SortedArrayList(natural)).toArray(), [1, 2]);
    assert.deepEqual(S.of(1, 1).collect(Collectors.HashSet()).toArray(), [1]);
    assert.deepEqual(S.of(1, 1).collect(Collectors.CacheSet()).toArray(), [1]);
    assert.deepEqual(S.of(2, 1).collect(Collectors.TreeSet(natural)).toArray(), [1, 2]);
    assert.deepEqual([...S.of(2, 1).collect(Collectors.PriorityQueue(natural))], [1, 2]);
    assert.deepEqual([...S.from(pairs).collect(Collectors.HashMap())], pairs);
    assert.deepEqual([...S.from(pairs).collect(Collectors.CacheMap())], pairs);
    assert.deepEqual([...S.from(pairs).collect(Collectors.TreeMap<string, number>(strings)).keys()], ["a", "b"]);
    assert.deepEqual([...S.from(pairs).collect(Collectors.Dictionary())], pairs);
    assert.deepEqual(S.of(1).collect(ArrayList.from).toArray(), [1]);
});

test("streams support for await", async () => {
    const values: number[] = [];
    for await (const value of S.of(1, 2)) values.push(value);
    assert.deepEqual(values, [1, 2]);
});
