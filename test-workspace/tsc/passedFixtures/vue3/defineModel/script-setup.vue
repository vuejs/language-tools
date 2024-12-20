<script setup lang="ts">
import { exactType } from '../../shared';

const a = defineModel<string>(); // modelValue
// const b = defineModel<string>({ required: true });
const c = defineModel<number>('c', { required: true });
const d = defineModel<number>('d', { required: false });
const e = defineModel<string>('e', { required: true });
const f = defineModel<string>('f', { required: false });
const g = defineModel<string>('g');

exactType(a.value, {} as string | undefined);
// exactType(b.value, {} as string);
exactType(c.value, {} as number);
exactType(d.value, {} as number | undefined);
exactType(e.value, {} as string);
exactType(f.value, {} as string | undefined);
exactType(g.value, {} as string | undefined);
</script>

<template>
    {{ exactType($props.modelValue, {} as string | undefined) }}
    <!-- {{ exactType($props.b, {} as string) }} -->
    {{ exactType($props.c, {} as number) }}
    {{ exactType($props.d, {} as number | undefined) }}
    {{ exactType($props.e, {} as string) }}
    {{ exactType($props.f, {} as string | undefined) }}
    {{ exactType($props.g, {} as string | undefined) }}
</template>
