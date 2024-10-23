<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { exactType } from '../../shared';

const comp1 = useTemplateRef('generic');
if (comp1.value) {
	exactType(comp1.value.foo, 1);
}

const comp2 = useTemplateRef('v-for');
if (comp2.value) {
	exactType(comp2.value[0]?.foo, {} as number | undefined);
}

const comp3 = useTemplateRef('a');
if (comp3.value) {
	exactType(comp3.value.href, {} as string);
}
</script>

<template>
	<GenericGlobal ref="generic" :foo="1"/>
	{{ exactType(comp1?.foo, {} as 1 | undefined) }}

	<GenericGlobal v-for="i in 4" ref="v-for" :foo="i"/>
	{{ exactType(comp2?.[0]?.foo, {} as number | undefined) }}

	<a ref="a"></a>
	{{ exactType(comp3?.href, {} as string | undefined) }}
</template>
