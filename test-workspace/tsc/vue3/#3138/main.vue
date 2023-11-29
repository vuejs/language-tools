<script setup lang="ts">
import { exactType } from 'tsc/shared';

declare const Child: undefined | (new () => {
	$props: {
		foo?(num: number): void;
	};
});
</script>

<template>
	<template v-if="Child">
		<Child :foo="num => exactType(num, {} as number)" />
	</template>
</template>
