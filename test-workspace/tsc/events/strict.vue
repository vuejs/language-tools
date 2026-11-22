<!-- @strictTemplates true -->

<template>
	<C1 @barBaz="exactType($event, {} as number)" />
</template>

<script lang="ts" setup>
import { defineComponent } from 'vue';
import { exactType } from '../shared';

const C1 = defineComponent({ emits: { 'bar-baz': (_num: number) => true } });
</script>
