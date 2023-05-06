import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<template>
	{{title}}
</template>
	`.trim(),
	output: `
<template>
	{{ title }}
</template>
	`.trim(),
});
