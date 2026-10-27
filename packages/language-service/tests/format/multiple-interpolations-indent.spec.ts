import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	formatsTypeScript: true,
	languageId: 'vue',
	input: `
<template>
	{{
		foo
	}}
	{{
			bar
		}}
</template>
	`.trim(),
	output: `
<template>
	{{
		foo
	}}
	{{
		bar
	}}
</template>
	`.trim(),
});
