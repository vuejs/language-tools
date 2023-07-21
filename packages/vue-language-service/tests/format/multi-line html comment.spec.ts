import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<template>
	<div></div>
	<!--
		hey
	-->
	<div></div>
</template>
	`.trim(),
});
