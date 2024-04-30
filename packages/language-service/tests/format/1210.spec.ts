import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);
</script>

<template>
	<button @click="count++">{{ count }}</button>
</template>
	`.trim(),
	settings: {
		'typescript.format.semicolons': 'insert'
	},
});
