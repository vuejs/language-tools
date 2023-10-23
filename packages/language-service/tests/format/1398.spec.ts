import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<template>
	<div v-for="i in list">{{ i }}</div>
</template>
	`.trim(),
	settings: {
		'javascript.format.insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis': true
	},
});
