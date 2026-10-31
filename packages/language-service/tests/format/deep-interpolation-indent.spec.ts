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
	<div>
	{{
		bar
	}}
	</div>
</template>
	`.trim(),
	output: `
<template>
	{{
		foo
	}}
	<div>
		{{
			bar
		}}
	</div>
</template>
	`.trim(),
});
