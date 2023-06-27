<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';

declare module 'vue' {
	export interface GlobalComponents {
		FunctionalComponent: any;
	}
}

declare const FunctionalComponent: new () => {
  $slots: {
		foo: (props: { bar: string }) => any;
	}
};
</script>
<template>
  <FunctionalComponent>
		<template #foo="{ bar }">
			{{ exactType(bar, '' as string) }}
		</template>
	</FunctionalComponent>
</template>