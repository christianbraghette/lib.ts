import { Collection, Queue, SortedQueue } from "./collections";
import { Comparator, TriConsumer, TriFunctional } from "./functional";
import { ArrayList } from "./list";
import { IterableObject } from "./objects";
import { Optional } from "./optional";
import { Stream } from "./stream";

export class PriorityQueue<T> extends IterableObject<T> implements SortedQueue<T> {
    #array = new ArrayList<T>();
    #compareFn: Comparator<T>;

    constructor(compareFn: Comparator<T>, iterable?: Iterable<T>) {
        super();
        this.#compareFn = compareFn;
        for (const data of iterable ?? [])
            this.add(data);
    }

    public comparator(): Comparator<T> {
        return this.#compareFn;
    };

    public get size() {
        return this.#array.size;
    }

    public first(): Optional<T> {
        return this.#array.first();
    }

    public add(...items: T[]): number {
        const size = this.#array.size;
        for (const item of items) {
            this.#array.add(item);
            this.#bubbleUp(this.size - 1);
        }
        return this.size - size;
    }

    public has(...items: T[]): boolean {
        return this.#array.has(...items);
    }

    public delete(...items: T[]): number {
        const size = this.#array.size;
        for (const item of items) {
            const index = this.#array.indexOf(item);
            if (index === -1) continue;

            const last = this.#array.removeLast().orThrow();
            if (index < this.size) {
                this.#array.set(index, last);
                this.#bubbleDown(index);
                this.#bubbleUp(index);
            }
        }
        return size - this.#array.size;
    }

    public remove(): Optional<T> {
        if (this.size === 0)
            return Optional.none();
        if (this.size === 1)
            return this.#array.removeLast();

        const top = this.#array.first();
        this.#array.set(0, this.#array.removeLast().orThrow());
        this.#bubbleDown(0);

        return top;
    }

    #bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.#compareFn(this.#array.get(index).orThrow(), this.#array.get(parentIndex).orThrow()) < 0) {
                this.#swap(index, parentIndex);
                index = parentIndex;
            } else {
                break;
            }
        }
    }

    #bubbleDown(index: number): void {
        while (true) {
            let smallest = index;
            const left = 2 * index + 1;
            const right = 2 * index + 2;

            if (left < this.size && this.#compareFn(this.#array.get(left).orThrow(), this.#array.get(smallest).orThrow()) < 0) {
                smallest = left;
            }
            if (right < this.size && this.#compareFn(this.#array.get(right).orThrow(), this.#array.get(smallest).orThrow()) < 0) {
                smallest = right;
            }

            if (smallest !== index) {
                this.#swap(index, smallest);
                index = smallest;
            } else {
                break;
            }
        }
    }

    #swap(i: number, j: number): void {
        const aux = this.#array.get(i);
        this.#array.set(i, this.#array.get(j).orThrow());
        this.#array.set(j, aux.orThrow());
    }

    public clear(): void {
        this.#array = new ArrayList();
    }

    public forEach(consumer: TriConsumer<T, number, this>): void {
        let i = 0;
        for (const item of this) {
            consumer(item, i++, this);
        };
    }

    public toArray(): T[] {
        return Array.from(this);
    }

    public map<S>(fn: TriFunctional<T, number, this, S>): Queue<S> {
        const self = this;
        return new ArrayList(function* () {
            let i = 0;
            for (const value of self)
                yield fn(value, i++, self);
        }());
    }

    public flatMap<S>(fn: TriFunctional<T, number, this, S | Collection<S>>): Queue<S> {
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
        }());
    }

    public stream(): Stream<T> {
        return Stream.from(this);
    }

    *[Symbol.iterator](): IterableIterator<T> {
        if (this.size === 0) return;

        const indexHeap: number[] = [0];

        const compareIndices = (i: number, j: number) => {
            return this.#compareFn(this.#array.get(indexHeap[i]).orThrow(), this.#array.get(indexHeap[j]).orThrow());
        };

        while (indexHeap.length > 0) {
            const currentIndex = indexHeap[0];

            yield this.#array.get(currentIndex).orThrow();

            const lastIndex = indexHeap.pop()!;
            if (indexHeap.length > 0) {
                indexHeap[0] = lastIndex;

                let idx = 0;
                while (true) {
                    let smallest = idx;
                    const left = 2 * idx + 1;
                    const right = 2 * idx + 2;

                    if (left < indexHeap.length && compareIndices(left, smallest) < 0) smallest = left;
                    if (right < indexHeap.length && compareIndices(right, smallest) < 0) smallest = right;

                    if (smallest !== idx) {
                        const temp = indexHeap[idx];
                        indexHeap[idx] = indexHeap[smallest];
                        indexHeap[smallest] = temp;
                        idx = smallest;
                    } else {
                        break;
                    }
                }
            }

            const leftChild = 2 * currentIndex + 1;
            const rightChild = 2 * currentIndex + 2;

            for (const child of [leftChild, rightChild]) {
                if (child < this.size) {
                    indexHeap.push(child);

                    // Bubble Up nell'indexHeap
                    let idx = indexHeap.length - 1;
                    while (idx > 0) {
                        const parent = Math.floor((idx - 1) / 2);
                        if (compareIndices(idx, parent) < 0) {
                            const temp = indexHeap[idx];
                            indexHeap[idx] = indexHeap[parent];
                            indexHeap[parent] = temp;
                            idx = parent;
                        } else {
                            break;
                        }
                    }
                }
            }
        }
    }
}