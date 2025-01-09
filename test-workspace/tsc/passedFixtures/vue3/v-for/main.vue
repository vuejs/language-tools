<template>
  <!-- number -->
  <div v-for="(val, index) in 10">
    {{ exactType(val, {} as number) }}
    {{ exactType(index, {} as number) }}
  </div>
  <!-- string -->
  <div v-for="(val, index) in 'foo'">
    {{ exactType(val, {} as string) }}
    {{ exactType(index, {} as number) }}
  </div>
  <!-- array -->
  <div v-for="(val, index) in arr">
    {{ exactType(val, {} as 'a' | 'b') }}
    {{ exactType(index, {} as number) }}
  </div>
  <!-- map -->
  <div v-for="(val, index) in map">
    {{ exactType(val, {} as [string, number]) }}
    {{ exactType(index, {} as number) }}
  </div>
  <!-- obj -->
  <div v-for="(val, key, index) in obj">
    {{ exactType(val, {} as string | number) }}
    {{ exactType(key, {} as 'a' | 'b') }}
    {{ exactType(index, {} as number) }}
  </div>
  <!-- objUnion -->
  <div v-for="(val, key, index) in objUnion">
    <!-- {{ exactType(val, {} as string | number) }} -->
    {{ exactType(val, {} as string) }}
    <!-- {{ exactType(key, {} as 'a' | 'b') }} -->
    {{ exactType(key, {} as 'a') }}
    {{ exactType(index, {} as number) }}
  </div>
  <!-- record -->
  <div v-for="(val, key, index) in record">
    {{ exactType(val, {} as string) }}
    {{ exactType(key, {} as string) }}
    {{ exactType(index, {} as number) }}
  </div>
  <!-- any -->
  <div v-for="(val, index) in _any">
    {{ exactType(val, {} as any) }}
    {{ exactType(index, {} as number) }}
  </div>
</template>

<script setup lang="ts">
import { exactType } from '../../shared';

const arr = ['a', 'b'] as const;
const map = new Map<string, number>();
const obj = { a: '', b: 0 };
const objUnion = { a: '' } as { a: string } | { a: string, b: number };
const record: Record<string, string> = { a: '' };
const _any = {} as any;
</script>
