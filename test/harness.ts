/*
 * A tiny test harness, so the repo needs no test framework or @types/node.
 * Each test file calls `test(...)`; test/run.mjs bundles and runs them and reports failures.
 */

type TestFn = () => void | Promise<void>;
const tests: Array<{ name: string; fn: TestFn }> = [];

export function test(name: string, fn: TestFn): void {
    tests.push({ name, fn });
}

export class AssertionError extends Error {}

function show(v: unknown): string {
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

export function eq<T>(actual: T, expected: T, message = ""): void {
    if (!Object.is(actual, expected)) throw new AssertionError(`${message} expected ${show(expected)}, got ${show(actual)}`);
}

export function deepEq(actual: unknown, expected: unknown, message = ""): void {
    if (show(actual) !== show(expected)) throw new AssertionError(`${message} expected ${show(expected)}, got ${show(actual)}`);
}

export function near(actual: number, expected: number, epsilon = 1e-6, message = ""): void {
    if (!(Math.abs(actual - expected) <= epsilon)) throw new AssertionError(`${message} expected ~${expected}, got ${actual}`);
}

export function ok(value: unknown, message = "expected truthy"): void {
    if (!value) throw new AssertionError(message);
}

export function throws(fn: () => unknown, match?: RegExp): void {
    try {
        fn();
    } catch (err) {
        if (match && !match.test(String((err as Error).message))) throw new AssertionError(`threw "${(err as Error).message}", expected ${match}`);
        return;
    }
    throw new AssertionError("expected function to throw");
}

/** Run every registered test; returns the number of failures. */
export async function run(file: string): Promise<number> {
    let failed = 0;
    for (const t of tests) {
        try {
            await t.fn();
            (globalThis as any).__results.push({ file, name: t.name, ok: true });
        } catch (err) {
            failed++;
            (globalThis as any).__results.push({ file, name: t.name, ok: false, error: String((err as Error)?.stack ?? err) });
        }
    }
    tests.length = 0;
    return failed;
}
