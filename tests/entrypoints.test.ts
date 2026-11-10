/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

// Each entry point loads in a fresh process, because a circular import only fails when it is loaded first.
function run(args: string[]) {
    const result = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
}

const entries: Record<string, string[]> = {
    "easylib.ts": ["ArrayList", "HashMap", "HashTable", "StreamIterator", "Optional", "Some", "None", "Result", "Ok", "Err", "Mutex", "pipe"],
    "easylib.ts/collections": ["ArrayList", "SortedArrayList", "PriorityQueue", "HashSet", "CacheSet", "TreeSet"],
    "easylib.ts/maps": ["HashMap", "CacheMap", "TreeMap", "HashTable"],
    "easylib.ts/stream": ["StreamIterator", "Collectors"],
    "easylib.ts/utils": ["Optional", "Some", "None", "isSome", "isNone", "Result", "Ok", "Err", "isOk", "isErr", "Dictionary", "Mutex", "Semaphore", "pipe"],
};

for (const [entry, names] of Object.entries(entries)) {
    test(`${entry} loads first with require`, () => {
        const keys = run(["-e", `console.log(Object.keys(require(${JSON.stringify(entry)})).join())`]).split(",");
        for (const name of names)
            assert.ok(keys.includes(name), `missing export ${name}`);
    });

    test(`${entry} loads first with import`, () => {
        const output = run(["--input-type=module", "-e", `import { ${names[0]} as x } from ${JSON.stringify(entry)}; console.log(typeof x)`]);
        assert.equal(output, "function");
    });
}
