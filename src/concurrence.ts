import { Consumer, Executor, Supplier } from "./functional";

type RejectReason = 'reset' | 'error' | 'timeout';

export interface SemaphoreLock<T> {
    get(): T;
    release(): void;
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
            this.#head = undefined;
            this.#tail = undefined;
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

export class Semaphore<T> {
    #supplier: Supplier<T>;
    #count: number;
    #maxCount: number;
    readonly #queue = new SemaphoreQueue<T>();

    public constructor(supplier: Supplier<T>, maxCount: number) {
        this.#supplier = supplier;
        this.#count = maxCount;
        this.#maxCount = maxCount;
    }

    public get maxCount(): number {
        return this.#maxCount;
    }

    public get count(): number {
        return this.#count;
    }

    public get locked(): boolean {
        return this.#count < 1;
    };

    public get waiters(): number {
        return this.#queue.size;
    }

    readonly #resolver = () => {
        if (this.#count++ < 0)
            this.#queue.remove()?.resolve(new LockConstructor(this.#supplier(), this.#resolver));
    }

    public acquire(timeoutMs?: number): Promise<SemaphoreLock<T>> {
        if (this.#count > 0) {
            this.#count--;
            return Promise.resolve<SemaphoreLock<T>>(new LockConstructor(this.#supplier(), this.#resolver));
        }
        return new Promise((resolve, reject) => {
            this.#count--;

            let timeout: number;

            const entry = new QueueNode((lock: SemaphoreLock<T>) => {
                clearTimeout(timeout);
                resolve(lock);
            }, reject);

            if (timeoutMs)
                timeout = setTimeout(() => {
                    this.#queue.delete(entry);
                    reject('timeout');
                }, timeoutMs)

            this.#queue.add(entry);
        });
    }

    public tryAcquire(): SemaphoreLock<T> | undefined {
        if (this.#count > 0) {
            this.#count--;
            return new LockConstructor(this.#supplier(), this.#resolver);
        }
        return;
    }

    public releaseAll(): void {
        for (let node = this.#queue.remove(); !!node; node = this.#queue.remove())
            node?.resolve(LockConstructor.released(this.#supplier()));
        this.#count = this.#maxCount;
    }

    public rejectAll(): void {
        for (let node = this.#queue.remove(); !!node; node = this.#queue.remove())
            node?.reject('reset');
        this.#count = this.#maxCount;
    }

    public async run(callbackFn: (obj: T, release: Executor) => void, ms?: number): Promise<void> {
        const lock = await this.acquire(ms);
        try {
            return callbackFn(this.#supplier(), lock.release);
        } catch (error) {
            throw error;
        } finally {
            lock.release();
        }
    }
}

export class Mutex<T> extends Semaphore<T> {
    constructor(obj: T) {
        super(() => obj, 1);
    }
}

class LockConstructor<T> implements SemaphoreLock<T> {
    #obj: T;
    #released: boolean;
    #releaser?: Executor;

    constructor(obj: T, releaser?: Executor, released: boolean = false) {
        this.#obj = obj;
        this.#released = released;
        this.#releaser = releaser;
    }

    public get(): T {
        return this.#obj;
    }

    public get release(): Executor {
        return () => {
            if (this.#released) return;
            this.#released = true;
            this.#releaser?.();
        }
    };

    public get locked() {
        return !this.#released;
    }

    public static released<S>(obj: S): SemaphoreLock<S> {
        return new LockConstructor(obj, undefined, true);
    }

}