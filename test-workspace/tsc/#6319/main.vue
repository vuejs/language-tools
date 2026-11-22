<script setup lang="ts">
import type { ExtractPropTypes } from 'vue';
import { exactType } from '../shared';

declare const Comp: new () => {
	$props: ExtractPropTypes<'input'> & { onFoo?: (num: number) => void };
};
</script>

<template>
	<Comp @foo="num => exactType(num, {} as number)" />
</template>
