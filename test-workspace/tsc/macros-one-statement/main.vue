<script setup lang="ts">
import { exactType } from '../shared';

const { x } = defineProps<{ x: 1 }>(), { y } = defineSlots<{ y(props: { n: number }): any }>();
exactType(x, {} as 1);
exactType(y, {} as (props: { n: number }) => any);
</script>

<template>
	{{ exactType(x, {} as 1) }}
</template>
