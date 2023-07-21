import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<template>
	<HelloWorld :msg="123" />
</template>
	`.trim(),
	settings: {
		'typescript.format.insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis': true,
		'javascript.format.insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis': true
	},
});
