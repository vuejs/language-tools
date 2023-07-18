import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<script setup lang="ts"></script>

<template>
	<!--
		hey
	-->
</template>
	`.trim(),
});
