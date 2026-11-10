/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { HashTable, Mutex, Semaphore } from "easylib.ts";

test("Mutex serialises access in FIFO order", async () => {
    const mutex = new Mutex<number[]>([]);
    await Promise.all([1, 2, 3].map(async n => {
        const lock = await mutex.acquire();
        await sleep(1);
        lock.get().push(n);
        lock.release();
    }));
    const lock = mutex.tryAcquire();
    assert.deepEqual(lock?.get(), [1, 2, 3]);
});

test("Semaphore limits holders and reports its state", async () => {
    const semaphore = new Semaphore(() => "x", 2);
    const first = await semaphore.acquire();
    await semaphore.acquire();
    assert.equal(semaphore.count, 0);
    assert.equal(semaphore.locked, true);
    assert.equal(semaphore.tryAcquire(), undefined);

    const waiting = semaphore.acquire();
    assert.equal(semaphore.waiters, 1);
    first.release();
    first.release();
    assert.equal((await waiting).get(), "x");
    assert.equal(semaphore.waiters, 0);
    assert.equal(semaphore.count, 0);
});

test("a timed-out acquire returns its slot and leaves other waiters queued", async () => {
    const mutex = new Mutex(0);
    const held = await mutex.acquire();
    const timedOut = mutex.acquire(5);
    const waiting = mutex.acquire();

    await assert.rejects(timedOut, (reason: unknown) => reason === "timeout");
    assert.equal(mutex.waiters, 1);

    held.release();
    const next = await waiting;
    next.release();
    assert.equal(mutex.count, 1);
    assert.equal(mutex.locked, false);
});

test("a timeout in the middle of the queue keeps the waiters around it", async () => {
    const mutex = new Mutex(0);
    const held = await mutex.acquire();
    const first = mutex.acquire();
    const timedOut = mutex.acquire(5);
    const last = mutex.acquire();

    await assert.rejects(timedOut);
    held.release();
    (await first).release();
    (await last).release();
    assert.equal(mutex.count, 1);
});

test("run holds the lock until an async callback settles", async () => {
    const mutex = new Mutex(0);
    let heldInside = false;
    const result = await mutex.run(async () => {
        await sleep(1);
        heldInside = mutex.locked;
        return "done";
    });
    assert.equal(heldInside, true);
    assert.equal(result, "done");
    assert.equal(mutex.locked, false);
});

test("run releases the lock when the callback throws", async () => {
    const mutex = new Mutex(0);
    await assert.rejects(mutex.run(() => { throw new Error("boom"); }), /boom/);
    assert.equal(mutex.locked, false);
});

test("run calls the supplier once per lock", async () => {
    let created = 0;
    const semaphore = new Semaphore(() => ++created, 1);
    assert.equal(await semaphore.run(value => value), 1);
    assert.equal(created, 1);
});

test("rejectAll and releaseAll reset the semaphore", async () => {
    const mutex = new Mutex(0);
    const stale = await mutex.acquire();
    const rejected = mutex.acquire();
    mutex.rejectAll();
    await assert.rejects(rejected, (reason: unknown) => reason === "reset");
    assert.equal(mutex.count, 1);

    stale.release();
    assert.equal(mutex.count, 1);

    const held = await mutex.acquire();
    const released = mutex.acquire(1000);
    mutex.releaseAll();
    assert.equal((await released).locked, false);
    assert.equal(mutex.count, 1);
    held.release();
    assert.equal(mutex.count, 1);
});

test("HashTable get resolves to an Optional, including for missing keys", async () => {
    const table = HashTable.of([1, "a"]);
    assert.equal((await table.get(1)).orThrow(), "a");
    assert.equal((await table.get(2)).isNone(), true);
});

test("HashTable applies operations in call order", async () => {
    const table = new HashTable<string, number>();
    table.set("a", 1).set("b", 2);
    assert.equal(await table.has("a", "b"), true);
    assert.equal(await table.add(["c", 3]), 1);
    assert.equal(await table.delete("a"), 1);
    assert.deepEqual((await table.keys()).toArray(), ["b", "c"]);
    assert.deepEqual((await table.values()).toArray(), [2, 3]);

    const seen: [number, string][] = [];
    await table.forEach((value, key) => seen.push([value, key]));
    assert.deepEqual(seen, [[2, "b"], [3, "c"]]);

    const entries: [string, number][] = [];
    for await (const entry of table) entries.push(entry);
    assert.deepEqual(entries, [["b", 2], ["c", 3]]);

    await table.clear();
    assert.equal((await table.entries()).count(), 0);
});

test("HashTable streams are snapshots", async () => {
    const table = HashTable.of(["a", 1]);
    const keys = await table.keys();
    await table.add(["b", 2]);
    assert.deepEqual(keys.toArray(), ["a"]);
});

test("HashTable accessor holds the lock and fails after close", async () => {
    const table = HashTable.of(["a", 1]);
    const accessor = await table.open();
    const pending = table.get("a");
    accessor.set("a", 2);
    assert.equal(accessor.size, 1);
    accessor.close();
    assert.equal((await pending).orThrow(), 2);
    assert.throws(() => accessor.size, /locked/);
});
