<script setup lang="ts">
import { exactType } from 'tsc/passedFixtures/shared';
import Child from './child.vue';
import { useTemplateRef } from 'vue';

const child = useTemplateRef('child');
exactType(child.value?.a, {} as unknown);
</script>

<template>
	<Child ref="child" />
</template>
