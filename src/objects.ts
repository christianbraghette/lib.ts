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

class EmptyValue extends Error {
    constructor() {
        super("Value not present");
    }
}

export class NA implements Object {
    valueOf(): Throwable<never> {
        throw new EmptyValue();
    }

    get [Symbol.toStringTag]() {
        return "<NA>";
    }

    public static isNA(obj: any): boolean {
        if (!!obj.isNA)
            return new Boolean(obj.isNA()).valueOf();
        try {
            obj.valueOf();
            return false;
        } catch (error) {
            if (error instanceof EmptyValue)
                return true
            throw error;
        }
    }

    public static toString(): string {
        return "<NA>";
    }
}

export interface Comparable {
    compare(other: any): number;
    equals(other: any): boolean;
}

export interface Nullable {
    valueOf(): Throwable<any>
    isNA(): boolean;
}

/*export class Boolean implements Object, Comparable, Nullable {
    #value?: boolean;
    #empty = false;

    constructor(value?: boolean) {
        if (value === undefined || value === null)
            this.#empty = true;
        else
            this.#value = value;
    }

    isNA(): boolean {
        return this.#empty;
    }

    valueOf(): Throwable<boolean> {
        if (this.#empty)
            throw new EmptyValue();
        return this.#value!;
    }

    compare(other: boolean | Boolean): number {
        return Boolean.#comparator(this, other)
    }

    equals(other: boolean | Boolean): boolean {
        return Boolean.#comparator(this, other) === 0;
    }

    toString(): string {
        return this.#empty ? NA.toString() : String.of(this.#value!).toString();
    }

    public static isTrue(value: boolean | Boolean): boolean {
        try {
            return value.valueOf() === true;
        } catch {
            return false;
        }
    }

    public static isFalse(value: boolean | Boolean) {
        try {
            return value.valueOf() === false;
        } catch (error) {
            return false;
        }
    }

    static #comparator: Comparator<Boolean | boolean> = (a: Boolean | boolean, b: Boolean | boolean) => {
        return a.valueOf() === b.valueOf() ? 0 : -1;
    }

    public static comparator(): Comparator<Boolean | boolean> {
        return this.#comparator;
    }

    public static empty(): Boolean {
        return new Boolean();
    }

    public static of(value?: boolean) {
        return new Boolean(value);
    }
}


export class Number extends NativeNumber implements Object, Comparable, Nullable {
    #empty = false;

    constructor(value?: number) {
        super(value);
        if (value === undefined || value === null)
            this.#empty = true;
    }

    isNA(): boolean {
        return this.#empty;
    }

    valueOf(): Throwable<number> {
        if (this.#empty)
            throw new EmptyValue();
        return super.valueOf();
    }

    compare(other: Number | number): number {
        return Number.#comparator(this, other)
    }

    equals(other: Number | number): boolean {
        return Number.#comparator(this, other) === 0;
    }

    toString(): string {
        return this.#empty ? NA.toString() : super.toString();
    }

    public static isNaN(number: number | Number) {
        return super.isNaN(number) || NA.isNA(this);
    }

    static #comparator: Comparator<Number | number> = (a: Number | number, b: Number | number) => {
        return a.valueOf() - b.valueOf();
    }

    public static comparator(): Comparator<Number | number> {
        return this.#comparator;
    }

    public static empty(): Number {
        return new Number();
    }

    public static of(value?: number) {
        return new Number(value);
    }
}

export class String extends NativeString implements Object, Comparable, Nullable {
    #empty = false;

    constructor(value?: any) {
        super(value);
        if (value === undefined || value === null)
            this.#empty = true;
    }

    isNA(): boolean {
        return this.#empty;
    }

    valueOf(): Throwable<string> {
        if (this.#empty)
            throw new EmptyValue();
        return super.valueOf();
    }

    compare(other: String | string): number {
        return String.#comparator(this, other)
    }

    equals(other: String | string): boolean {
        return String.#comparator(this, other) === 0;
    }

    toString(): string {
        return this.#empty ? NA.toString() : super.toString();
    }

    static #comparator: Comparator<String | string> = (a: String | string, b: String | string) => {
        return a.valueOf() === b.valueOf() ? 0 : a.valueOf() < b.valueOf() ? -1 : 1;
    }

    public static comparator(): Comparator<String | string> {
        return this.#comparator;
    }

    public static empty(): String {
        return new String();
    }

    public static of(value?: any) {
        return new String(value);
    }
}*/