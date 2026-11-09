import { Functional } from "./functional";
import { StreamIterator } from "./stream";

export abstract class IterableObject<T, R = void> implements Iterable<T, R> {
    public iterator(): StreamIterator<T> {
        return new StreamIterator(this[Symbol.iterator].bind(this));
    }

    abstract [Symbol.iterator](): IterableIterator<T, R>;
}

export abstract class AsyncIterableObject<T, R = void> extends IterableObject<T, R> implements AsyncIterable<T, R> {
    public asyncIterator() {
        return this[Symbol.asyncIterator]();
    }

    abstract [Symbol.asyncIterator](): AsyncIterableIterator<T, R>;
}

export interface FunctionalObject {
    map<S>(fn: Functional<any, S>): FunctionalObject;
    flatMap<S>(fn: Functional<any, S | FunctionalObject>): FunctionalObject;
}