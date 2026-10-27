import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	formatsTypeScript: true,
	languageId: 'vue',
	input: `
<template>
	{{a?b:c}}
</template>
	`.trim(),
	output: `
<template>
	{{ a ? b : c }}
</template>
	`.trim(),
});
