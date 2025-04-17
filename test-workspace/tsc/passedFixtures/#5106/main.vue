<!-- @inferTemplateDollarAttrs true -->
 
<script setup lang="ts">
import { useAttrs } from 'vue';
import { exactType } from '../shared';

declare module 'vue' {
	interface ComponentCustomProperties {
		$attrs: {
			class: string;
		};
	}
}

type AttrsExact = Record<string, unknown> & { class: string } & Partial<{}>;

const attrs = useAttrs();
exactType(attrs, {} as AttrsExact);
</script>

<template>
	{{ exactType($attrs, {} as AttrsExact) }}
</template>
