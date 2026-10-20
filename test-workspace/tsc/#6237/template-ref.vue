<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import Child from './child.vue';

const selected = ref('');
const table = useTemplateRef('child');
</script>

<template>
	<Child ref="child" :value="selected" />
	{{ table?.$props.value }}
	<!-- @vue-expect-error -->
	{{ table?.missing }}
</template>
