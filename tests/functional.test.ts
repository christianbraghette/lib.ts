/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { BinaryOperator, Comparator, Consumer, Dictionary, Functional, Pipeline, Predicate, Some, Supplier, UnaryOperator, pipe } from "easylib.ts";

test("Predicate helpers", () => {
    assert.equal(Predicate.isTrue()(true), true);
    assert.equal(Predicate.isTrue()(false), false);
    assert.equal(Predicate.isFalse()(false), true);
    assert.equal(Predicate.isFalse()(true), false);
    assert.equal(Predicate.isNullish()(null), true);
    assert.equal(Predicate.not<number>(Predicate.isEven())(1), true);
    assert.equal(Predicate.every<number>(Predicate.isEven(), Predicate.isBetween(3, 9))(4), true);
    assert.equal(Predicate.some<number>(Predicate.isEven(), Predicate.isBetween(3, 9))(1), false);
    assert.equal(Predicate.isEmpty<string>()(""), true);
});

test("Comparator helpers", () => {
    const natural = Comparator.natural<number>();
    assert.deepEqual([2, 1, 3].sort(Comparator.reverse(natural)), [3, 2, 1]);
    assert.equal(Comparator.thenComparing<number>(() => 0, () => 5)(1, 2), 5);
    assert.equal(Comparator.nullsLast(natural)(null, 1), 1);
    assert.equal(Comparator.nullsLast(natural)(1, undefined), -1);
    const byAge = Comparator.byProperty<{ age: number }, "age">("age", natural);
    assert.equal(byAge({ age: 1 }, { age: 2 }), -1);
});

test("operators", () => {
    assert.equal(BinaryOperator.sum()(1, 2), 3);
    assert.equal(BinaryOperator.pow()(2, 3), 8);
    assert.equal(BinaryOperator.concat("-")("a", "b"), "a-b");
    assert.equal(BinaryOperator.max(Comparator.natural<number>())(1, 2), 2);
    assert.equal(UnaryOperator.clamp(0, 5)(9), 5);
    assert.equal(UnaryOperator.trim()(" a "), "a");
});

test("Functional, Supplier and Consumer helpers", () => {
    assert.equal(Functional.compose((n: number) => n + 1, n => n * 2)(1), 4);
    assert.equal(Functional.extract<{ a: number }, "a">("a")({ a: 1 }), 1);
    assert.equal(Functional.withDefault<number, number>(() => null, 7)(0), 7);

    const next = Supplier.sequence(5);
    next();
    assert.equal(next(), 6);

    let built = 0;
    const memo = Supplier.memoize(() => ++built);
    memo();
    assert.equal(memo(), 1);

    const seen: number[] = [];
    Consumer.combine<number>(v => seen.push(v), v => seen.push(v * 2))(1);
    assert.deepEqual(seen, [1, 2]);
});

test("pipe builds a callable Pipeline", () => {
    const pipeline = pipe((s: string) => s.trim(), s => s.length);
    assert.equal(pipeline(" ab "), 2);
    assert.equal(pipeline.call(" a "), 1);
    assert.equal(pipeline.bind("abc")(), 3);
    assert.equal(pipeline.apply(() => "ab"), 2);
    assert.equal(pipeline.map(n => n * 10)("ab"), 20);
    assert.deepEqual(pipeline.iterate(["a", "bb"]).toArray(), [1, 2]);
    assert.equal(pipeline instanceof Pipeline, true);
    assert.equal(String(pipeline), "[object Pipeline]");
});

test("pipe leaves the caller's functions untouched", () => {
    const fn = (n: number) => n + 1;
    assert.equal(pipe(fn)(1), 2);
    assert.equal(fn instanceof Pipeline, false);
    assert.equal(Object.isSealed(fn), false);
    assert.equal(fn.name, "fn");
});

test("an empty Pipeline is rejected", () => {
    assert.throws(() => new Pipeline(), /Empty Pipeline/);
});

test("Dictionary reads as Some or undefined", () => {
    const dict = Dictionary.of({ host: "localhost" });
    assert.equal(dict.host?.value, "localhost");
    assert.equal(dict.missing, undefined);
    (dict as any).user = "ada";
    assert.equal(dict.user?.value, "ada");
    dict.port = Some.of("5432");
    assert.deepEqual(Object.keys(dict), ["host", "user", "port"]);
    assert.equal(delete dict.user, true);
    assert.equal("user" in dict, false);
    assert.deepEqual([...dict], [["host", "localhost"], ["port", "5432"]]);
    assert.equal(String(dict), "[object Dictionary]");
});

test("Dictionary treats inherited names as ordinary keys", () => {
    const dict = Dictionary.from<string>([["constructor", "c"], ["__proto__", "p"]]);
    assert.equal((dict.constructor as unknown as Some<string>).value, "c");
    assert.equal(dict.__proto__?.value, "p");
    assert.equal("toString" in dict, false);
    (dict as any).toString = "t";
    assert.equal((dict.toString as unknown as Some<string>).value, "t");
});
