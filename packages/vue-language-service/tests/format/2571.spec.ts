import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<template>
	<div v-for="item in list"></div>
</template>
	`.trim(),
	settings: {
		'javascript.format.insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets': true,
		'typescript.format.insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets': true
	},
});
