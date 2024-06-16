<script setup lang="ts">
// @ts-nocheck wait for 3.3 added defineModel
import { exactType } from '../../shared';

const a = defineModel<string>(); // modelValue
// const b = defineModel<string>({ required: true });
const c = defineModel<number>('c', { required: true });
const d = defineModel<number>('d', { required: false });
const e = defineModel<string>('e');
const f = defineModel<string>('f', { required: true });
const g = defineModel<string>('g', { required: false });

exactType(a.value, {} as string | undefined);
// exactType(b.value, {} as string);
exactType(c.value, {} as number);
exactType(d.value, {} as number | undefined);
exactType(e.value, {} as string | undefined);
exactType(f.value, {} as string);
exactType(g.value, {} as string | undefined);
</script>

<template>
    {{ exactType($props.modelValue, {} as string | undefined) }}
    <!-- {{ exactType($props.b, {} as string) }} -->
    {{ exactType($props.c, {} as number) }}
    {{ exactType($props.d, {} as number | undefined) }}
    {{ exactType($props.e, {} as string | undefined) }}
    {{ exactType($props.f, {} as string) }}
    {{ exactType($props.g, {} as string | undefined) }}
</template>
