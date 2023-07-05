<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';

declare module 'vue' {
	export interface GlobalComponents {
		ComponentWithinTestIssue1886: any;
	}
}

declare const ComponentWithinTestIssue1886: new () => {
	$slots: {
		foo: (props: { bar: string }) => any;
	}
};
</script>

<template>
	<ComponentWithinTestIssue1886>
		<template #foo="{ bar }">
			{{ exactType(bar, {} as string) }}
		</template>
	</ComponentWithinTestIssue1886>
</template>
