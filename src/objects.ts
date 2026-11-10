/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import type { Functional, Supplier } from "./functional";
import type { StreamIterator } from "./stream";

type StreamFactory = <T>(source: Supplier<Iterable<T>>) => StreamIterator<T>;

let createStream: StreamFactory;

/**
 * Called by stream.ts as it loads. This module must not import stream.ts at runtime: stream.ts
 * transitively loads every class that extends the ones below, so whichever of them was imported
 * first would see an undefined base class. Every public entry point loads stream.ts.
 */
export function registerStreamFactory(factory: StreamFactory): void {
    createStream = factory;
}

export abstract class IterableObject<T, R = void> implements Iterable<T, R> {
    public iterator(): StreamIterator<T> {
        return createStream<T>(this[Symbol.iterator].bind(this) as Supplier<Iterable<T>>);
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
