import { Functional, GenericFunctional } from "./functional";
import { Throwable } from "./result";

export abstract class IterableObject<T, R = void> implements Iterable<T, R> {
    public iterator() {
        return this[Symbol.iterator]();
    }

    abstract [Symbol.iterator](): IterableIterator<T, R>;
}

export abstract class AsyncIterableObject<T, R = void> extends IterableObject<T, R> implements AsyncIterable<T, R> {
    public asyncIterator() {
        return this[Symbol.asyncIterator]();
    }

    abstract [Symbol.asyncIterator](): AsyncIterableIterator<T, R>;
}

export interface PipepableObject<F extends GenericFunctional<any, any>> {
    pipe(): F
}

export interface FunctionalObject extends PipepableObject<GenericFunctional<any, any>>, IterableObject<any> {
    map<S>(fn: Functional<any, S>): FunctionalObject;
    flatMap<S>(fn: Functional<any, S | FunctionalObject>): FunctionalObject;
}