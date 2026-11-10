/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Consumer, Executor, Supplier } from "./functional";

type RejectReason = 'reset' | 'error' | 'timeout';

/** A lock granted by a Semaphore. */
export interface SemaphoreLock<T> {
    /** Returns the guarded resource. */
    get(): T;
    /** Gives the lock back. Further calls do nothing. */
    release(): void;
    /** `true` until the lock is released. */
    readonly locked: boolean;
}

class QueueNode<T> {
    next?: QueueNode<T>;

    constructor(
        public readonly resolve: Consumer<SemaphoreLock<T>>,
        public readonly reject: Consumer<RejectReason>
    ) { }
}

class SemaphoreQueue<T> {
    #head?: QueueNode<T>;
    #tail?: QueueNode<T>;
    #size: number = 0;

    public get size(): number {
        return this.#size;
    }

    public add(node: QueueNode<T>): this {
        if (!this.#tail) {
            this.#head = node;
            this.#tail = node;
        } else {
            this.#tail.next = node;
            this.#tail = node;
        }
        this.#size++;
        return this;
    }

    public remove(): QueueNode<T> | undefined {
        if (!this.#head)
            return undefined;
        const node = this.#head;
        this.#head = node.next;
        if (!this.#head)
            this.#tail = undefined;
        this.#size--;
        return node;
    }

    public delete(node: QueueNode<T>): boolean {
        if (!this.#head)
            return false;
        if (this.#head === node) {
            this.#head = node.next;
            if (!this.#head)
                this.#tail = undefined;
            this.#size--;
            return true;
        }
        for (let iter: QueueNode<T> | undefined = this.#head; !!iter; iter = iter.next)
            if (iter.next === node) {
                iter.next = iter.next.next;
                if (!iter.next)
                    this.#tail = iter;
                this.#size--;
                return true;
            }
        return false;
    }
}

/**
 * Limits how many callers can use a resource at once. Waiters are served in first-in, first-out order.
 * @example
 * const pool = new Semaphore(() => "connection", 2);
 * const lock = await pool.acquire();
 * pool.count; // 1
 * lock.get(); // connection
 * lock.release();
 * await pool.run(connection => connection.length); // 10
 */
export class Semaphore<T> {
    #supplier: Supplier<T>;
    #count: number;
    #maxCount: number;
    /** Bumped by releaseAll and rejectAll, so locks taken before a reset cannot release permits after it. */
    #epoch: number = 0;
    readonly #queue = new SemaphoreQueue<T>();

    /**
     * Creates a semaphore.
     * @param supplier Provides the resource and is called once for each lock granted.
     * @param maxCount How many locks can be held at once.
     */
    public constructor(supplier: Supplier<T>, maxCount: number) {
        this.#supplier = supplier;
        this.#count = maxCount;
        this.#maxCount = maxCount;
    }

    /** How many locks can be held at once. */
    public get maxCount(): number {
        return this.#maxCount;
    }

    /** How many locks are free. A negative value is the number of callers waiting. */
    public get count(): number {
        return this.#count;
    }

    /** `true` when no lock is free. */
    public get locked(): boolean {
        return this.#count < 1;
    };

    /** How many callers are waiting for a lock. */
    public get waiters(): number {
        return this.#queue.size;
    }

    #createLock(): SemaphoreLock<T> {
        const epoch = this.#epoch;
        return new LockConstructor(this.#supplier(), () => this.#release(epoch));
    }

    #release(epoch: number): void {
        if (epoch !== this.#epoch)
            return;
        if (this.#count++ < 0)
            this.#queue.remove()?.resolve(this.#createLock());
    }

    /**
     * Waits for a lock. Always release it, usually in a `finally` block, or use `run`.
     * @param timeoutMs How long to wait. Omit it to wait indefinitely.
     * @returns A promise for the lock. It rejects with `"timeout"` when the wait expires, and with `"reset"` if `rejectAll` is called.
     */
    public acquire(timeoutMs?: number): Promise<SemaphoreLock<T>> {
        if (this.#count > 0) {
            this.#count--;
            return Promise.resolve(this.#createLock());
        }
        return new Promise((resolve, reject) => {
            this.#count--;

            let timeout: ReturnType<typeof setTimeout> | undefined;

            const entry = new QueueNode<T>((lock) => {
                clearTimeout(timeout);
                resolve(lock);
            }, (reason) => {
                clearTimeout(timeout);
                reject(reason);
            });

            if (timeoutMs)
                timeout = setTimeout(() => {
                    if (this.#queue.delete(entry)) {
                        this.#count++;
                        reject('timeout');
                    }
                }, timeoutMs)

            this.#queue.add(entry);
        });
    }

    /**
     * Takes a lock only if one is free right now.
     * @returns The lock, or `undefined` when none is free.
     */
    public tryAcquire(): SemaphoreLock<T> | undefined {
        if (this.#count > 0) {
            this.#count--;
            return this.#createLock();
        }
        return;
    }

    /** Resets the semaphore. Every waiter resolves with an already-released lock, and locks held before the reset no longer affect the count. */
    public releaseAll(): void {
        this.#epoch++;
        for (let node = this.#queue.remove(); !!node; node = this.#queue.remove())
            node?.resolve(LockConstructor.released(this.#supplier()));
        this.#count = this.#maxCount;
    }

    /** Resets the semaphore. Every waiter rejects with `"reset"`, and locks held before the reset no longer affect the count. */
    public rejectAll(): void {
        this.#epoch++;
        for (let node = this.#queue.remove(); !!node; node = this.#queue.remove())
            node?.reject('reset');
        this.#count = this.#maxCount;
    }

    /** Runs the callback while holding a lock, including until an async callback settles. */
    public async run<R>(callbackFn: (obj: T, release: Executor) => R | Promise<R>, ms?: number): Promise<R> {
        const lock = await this.acquire(ms);
        try {
            return await callbackFn(lock.get(), lock.release);
        } finally {
            lock.release();
        }
    }
}

/**
 * A Semaphore with a single lock, guarding one shared object.
 * @example
 * const counter = new Mutex({ value: 0 });
 * await counter.run(c => { c.value++; });
 * const lock = counter.tryAcquire();
 * lock?.get().value; // 1
 */
export class Mutex<T> extends Semaphore<T> {
    /**
     * Creates a mutex.
     * @param obj The object to guard.
     */
    constructor(obj: T) {
        super(() => obj, 1);
    }
}

/** The SemaphoreLock implementation. */
class LockConstructor<T> implements SemaphoreLock<T> {
    #obj: T;
    #released: boolean;
    #releaser?: Executor;

    constructor(obj: T, releaser?: Executor, released: boolean = false) {
        this.#obj = obj;
        this.#released = released;
        this.#releaser = releaser;
    }

    /** Returns the guarded resource. */
    public get(): T {
        return this.#obj;
    }

    /** Gives the lock back. Further calls do nothing. */
    public get release(): Executor {
        return () => {
            if (this.#released) return;
            this.#released = true;
            this.#releaser?.();
        }
    };

    /** `true` until the lock is released. */
    public get locked() {
        return !this.#released;
    }

    /**
     * Creates a lock that is already released.
     * @param obj The guarded resource.
     */
    public static released<S>(obj: S): SemaphoreLock<S> {
        return new LockConstructor(obj, undefined, true);
    }

}