<!-- @inferComponentDollarRefs true -->

<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { exactType } from '../../shared';
import Generic from './generic.vue';

const comp1 = useTemplateRef('generic');
if (comp1.value) {
	exactType(comp1.value.foo, 1);
}

const comp2 = useTemplateRef('v-for-generic');
if (comp2.value) {
	exactType(comp2.value[0]?.foo, {} as number | undefined);
}

const comp3 = useTemplateRef('native');
if (comp3.value) {
	exactType(comp3.value, {} as HTMLAnchorElement);
}

const comp4 = useTemplateRef('v-for-native');
if (comp4.value) {
	exactType(comp4.value, {} as HTMLAnchorElement[]);
}

// @ts-expect-error
useTemplateRef('unknown');
</script>

<template>
	<Generic ref="generic" :foo="1"/>
	{{ exactType(comp1?.foo, {} as 1 | undefined) }}

	<Generic v-for="i in 4" ref="v-for-generic" :foo="i"/>
	{{ exactType(comp2?.[0]?.foo, {} as number | undefined) }}

	<a ref="native"></a>
	{{ exactType(comp3?.href, {} as string | undefined) }}

	<a v-for="i in 3" ref="v-for-native" :key="i"></a>
	{{ exactType(comp4?.[0]?.href, {} as string | undefined) }}
</template>
