import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
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
