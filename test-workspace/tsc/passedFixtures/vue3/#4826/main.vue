<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { exactType } from '../../shared';
import Child from './child.vue';

const child = useTemplateRef('child');
exactType(child.value?.a, {} as HTMLAnchorElement | null | undefined);
</script>

<template>
	<Child ref="child" />
</template>
