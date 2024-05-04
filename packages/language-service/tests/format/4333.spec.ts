import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<template>
	<div v-on="{ click: onItemInteraction, keydown: onItemInteraction }"></div>
</template>
	`.trim(),
	settings: {
		'typescript.format.semicolons': 'insert',
	}
});
