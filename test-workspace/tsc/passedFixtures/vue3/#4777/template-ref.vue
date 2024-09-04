<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { exactType } from '../../shared';

const foo = 1;

const comp1 = useTemplateRef('generic');
if (comp1.value) {
	exactType(comp1.value.foo, 1);
}
</script>

<template>
	<GenericGlobal ref="generic" :foo/>
	{{ exactType(comp1?.foo, {} as 1 | undefined) }}
</template>
