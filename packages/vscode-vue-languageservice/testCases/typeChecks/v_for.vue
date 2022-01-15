<template>
  <!-- number -->
  <div v-for="(val, key) in 10">
    {{ exactType(val, expected as number) }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, expected as number) }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- string -->
  <div v-for="(val, key) in 'foo'">
    {{ exactType(val, expected as string) }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, expected as number) }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- array -->
  <div v-for="(val, key) in arr">
    {{ exactType(val, expected as 'a' | 'b') }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, expected as number) }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- map -->
  <div v-for="(val, key) in map">
    {{ exactType(val, expected as [string, number]) }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, expected as number) }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- obj -->
  <div v-for="(val, key) in obj">
    {{ exactType(val, expected as string | number) }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, expected as 'a' | 'b') }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- objUnion -->
  <div v-for="(val, key) in objUnion">
    {{ exactType(val, expected as string | number) }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, expected as 'a' | 'b') }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- record -->
  <div v-for="(val, key) in record">
    {{ exactType(val, expected as string) }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, expected as string) }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
</template>

<script lang="ts" setup>
const arr = ['a', 'b'] as const
const map = new Map<string, number>()
const obj = { a: '', b: 0 }
const objUnion = { a: '' } as { a: string } | { a:string, b: number }
const record: Record<string, string> = { a: '' }

declare const expected: any

// https://stackoverflow.com/a/53808212
type IfEquals<T, U, Y=unknown, N=never> =
  (<G>() => G extends T ? 1 : 2) extends
  (<G>() => G extends U ? 1 : 2) ? Y : N;
declare function exactType<T, U>(draft: T & IfEquals<T, U>, expected: U & IfEquals<T, U>): IfEquals<T, U>

// https://stackoverflow.com/a/49928360
type IfNotAny<T> = 0 extends 1 & T ? never : T
type IfNotUndefined<T> = Exclude<T, undefined> extends never ? never : T
declare function isNotAnyOrUndefined<T>(value: IfNotAny<IfNotUndefined<T>>): void
</script>
