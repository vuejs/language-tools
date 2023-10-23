import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<template>
<div style="
		width: 100%;
		height: 100%;
	"></div>
</template>
	`.trim(),
	output: `
<template>
	<div style="
		width: 100%;
		height: 100%;
	"></div>
</template>
	`.trim(),
});
