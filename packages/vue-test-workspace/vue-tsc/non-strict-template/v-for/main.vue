<template>
  <!-- number -->
  <div v-for="(val, key) in 10">
    {{ exactType(val, {} as number) }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, {} as number) }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- string -->
  <div v-for="(val, key) in 'foo'">
    {{ exactType(val, {} as string) }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, {} as number) }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- array -->
  <div v-for="(val, key) in arr">
    {{ exactType(val, {} as 'a' | 'b') }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, {} as number) }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- map -->
  <div v-for="(val, key) in map">
    {{ exactType(val, {} as [string, number]) }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, {} as number) }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- obj -->
  <div v-for="(val, key) in obj">
    {{ exactType(val, {} as string | number) }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, {} as 'a' | 'b') }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- objUnion -->
  <div v-for="(val, key) in objUnion">
    <!-- {{ exactType(val, {} as string | number) }} -->
    {{ exactType(val, {} as string) }}
    {{ isNotAnyOrUndefined(val) }}
    <!-- {{ exactType(key, {} as 'a' | 'b') }} -->
    {{ exactType(key, {} as 'a') }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- record -->
  <div v-for="(val, key) in record">
    {{ exactType(val, {} as string) }}
    {{ isNotAnyOrUndefined(val) }}
    {{ exactType(key, {} as string) }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
  <!-- any -->
  <div v-for="(val, key) in _any">
    {{ exactType(val, {} as any) }}
    {{ exactType(key, {} as number) }}
    {{ isNotAnyOrUndefined(key) }}
  </div>
</template>

<script setup lang="ts">
import { exactType, isNotAnyOrUndefined } from '../../shared';

const arr = ['a', 'b'] as const;
const map = new Map<string, number>();
const obj = { a: '', b: 0 };
const objUnion = { a: '' } as { a: string } | { a: string, b: number };
const record: Record<string, string> = { a: '' };
const _any = {} as any;
</script>
