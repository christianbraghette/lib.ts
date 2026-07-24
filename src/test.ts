import { ArrayList, Stack } from "./collections";
import { HashTable } from "./hashtable";
import { Stream } from "./stream";
import { Dictionary, UnaryOperator } from "./utils";

let test = HashTable.of([1, "Dio"], [2, "Cane"]);
test.forEach((value) => console.log(value));
test.open().then(accessor => accessor.entries()
    .map<[string, number]>(([key, value]) => [value, key])
    .filter(([_, value]) => value > 1)
    .every(([keyof, value]) => typeof value === 'number')).then(value => console.log(value));

test.open().then(test => {
    for (const i in Dictionary.from(test))
        console.log(i);
});

function fib() {
    return (cache: Stack<number>, n: number) => {
        if (n < 2) {
            cache.add(n);
            return n;
        }
        const n1 = cache.removeLast().get();
        const n2 = cache.removeLast().get();
        const n0 = n1 + n2;
        cache.add(n2, n1, n0);
        return n0;
    }
}

console.log("(Index, Value):", ...Stream.iterate(0, UnaryOperator.increment()).cacheMap(fib(), new ArrayList()).until(n => !Number.isFinite(n)).reduce((prev, value, index) => [index, value], [-1, -1]));