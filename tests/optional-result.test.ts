/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { Err, None, Ok, Optional, Result, Some, isErr, isNone, isOk, isSome } from "easylib.ts";

test("Optional.ofNullable maps null and undefined to None, and keeps falsy values", () => {
    assert.equal(Optional.ofNullable(null).isNone(), true);
    assert.equal(Optional.ofNullable(undefined).isNone(), true);
    assert.equal(Optional.ofNullable(0).isSome(), true);
    assert.equal(Optional.ofNullable("").isSome(), true);
});

test("Optional transforms and unwraps", () => {
    const some = Some.of(2), none = None.of<number>();
    assert.equal(some.map(n => n * 2).orElse(0), 4);
    assert.equal(none.map(n => n * 2).orElse(0), 0);
    assert.equal(some.filter(n => n > 5).isNone(), true);
    assert.equal(some.flatMap(n => Some.of(n + 1)).orThrow(), 3);
    assert.equal(none.orGet(() => 9), 9);
    assert.equal(none.or(some).orThrow(), 2);
    assert.equal(some.and(Some.of("x")).orThrow(), "x");
    assert.equal(none.and(some).isNone(), true);
    assert.equal(none.match({ some: () => "s", none: () => "n" }), "n");
    assert.deepEqual([...some], [2]);
    assert.deepEqual([...none], []);
    assert.equal(isSome(some), true);
    assert.equal(isNone(none), true);
});

test("Optional.orThrow throws the given error, or a default", () => {
    const custom = new RangeError("custom");
    assert.throws(() => None.of().orThrow(custom), custom);
    assert.throws(() => None.of().orThrow(), /Optional is empty/);
});

test("Optional.ifSome runs only when present and always runs finally", () => {
    const calls: string[] = [];
    Some.of("v").ifSome(v => calls.push(v)).finally(() => calls.push("f1"));
    None.of<string>().ifSome(v => calls.push(v)).finally(() => calls.push("f2"));
    assert.deepEqual(calls, ["v", "f1", "f2"]);
});

test("Optional is not a thenable, so it survives await", async () => {
    const some = Optional.ofNullable(5);
    const none = Optional.ofNullable(null);
    assert.equal(await (async () => some)(), some);
    assert.equal(await (async () => none)(), none);
});

test("Optional converts to Result and back", () => {
    const error = new RangeError("nope");
    assert.equal(Some.of(1).orErr(error).orThrow(), 1);
    const result = None.of<number>().orErr(error);
    assert.equal(result.isErr(), true);
    assert.equal(result.orNone().isNone(), true);
    assert.equal(Some.of(1).orErr(error).orNone().orThrow(), 1);
});

test("Result transforms and unwraps", () => {
    const error = new RangeError("bad");
    const ok: Result<number, RangeError> = Ok.of(2);
    const err: Result<number, RangeError> = Err.of(error);
    assert.equal(ok.map(n => n + 1).orElse(0), 3);
    assert.equal(err.map(n => n + 1).orElse(0), 0);
    assert.equal(ok.filter(n => n > 5, error).isErr(), true);
    assert.equal(ok.flatMap(n => Ok.of(n * 2)).orThrow(), 4);
    assert.equal(err.or(ok).orThrow(), 2);
    assert.equal(err.match({ ok: () => "o", err: e => e.message }), "bad");
    assert.equal(err.mapError(e => new TypeError(e.message + "!")).match({ ok: () => "", err: e => e.message }), "bad!");
    assert.throws(() => err.orThrow(), error);
    assert.equal(isOk(ok), true);
    assert.equal(isErr(err), true);
});

test("Result.try runs the matching branch and then finally", () => {
    const calls: string[] = [];
    Ok.of<string, Error>("v").try(v => calls.push(v)).catch(e => calls.push(e.message)).finally(() => calls.push("f1"));
    Err.of<Error, string>(new Error("e")).try(v => calls.push(v)).catch(e => calls.push(e.message)).finally(() => calls.push("f2"));
    assert.deepEqual(calls, ["v", "f1", "e", "f2"]);
});

test("Result.ofThrowable captures return values and thrown errors", () => {
    assert.equal(Result.ofThrowable(() => 42).orThrow(), 42);
    assert.equal(Result.ofThrowable<number, SyntaxError>(() => JSON.parse("{")).isErr(), true);
    const wrapped = Result.ofThrowable(() => { throw "text"; });
    assert.equal(wrapped.match({ ok: () => "", err: e => e.message }), "text");
});

test("Result.ofPromise captures resolutions and rejections", async () => {
    assert.equal((await Result.ofPromise(Promise.resolve(1))).orThrow(), 1);
    const failed = await Result.ofPromise(Promise.reject(new Error("no")));
    assert.equal(failed.match({ ok: () => "", err: e => e.message }), "no");
});
