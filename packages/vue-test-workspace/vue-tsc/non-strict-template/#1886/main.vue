<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';

declare module 'vue' {
	export interface GlobalComponents {
		ComponentForIssue1886: any;
	}
}

declare const ComponentForIssue1886: new () => {
	$slots: {
		foo: (props: { bar: string }) => any;
	}
};
</script>

<template>
	<ComponentForIssue1886>
		<template #foo="{ bar }">
			{{ exactType(bar, {} as string) }}
		</template>
	</ComponentForIssue1886>
</template>
