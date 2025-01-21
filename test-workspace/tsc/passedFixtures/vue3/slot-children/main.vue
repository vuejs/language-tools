<script lang="ts" setup>
import Child from './child.vue';
import Parent from './parent.vue';

const foo = {} as 'a' | 'b';
</script>

<template>
	<Parent :foo>
		<Child :foo="(`a` as const)" />
		<Child :foo="(`b` as const)" />
		<!-- @vue-expect-error -->
		<Child :foo="(`c` as const)" /> 
	</Parent>
</template>
