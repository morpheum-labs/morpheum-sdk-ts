/**
 * Compile-time assertion helper: instantiating with `false` is a type error.
 *
 * The type-level pins beside the code they guard are built on it; `tsc
 * --noEmit` is what evaluates them.
 */
export type Assert<T extends true> = T;
