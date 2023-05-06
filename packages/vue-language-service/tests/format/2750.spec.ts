import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<template>
	<a-select v-model:value="modelSelectValue">
		<a-select-option v-for="item of executorModel" :key="item" :value="item"
			@click="modelSelectValue = item; modelSelectOpen = 0;">{{ item }}</a-select-option>
	</a-select>
</template>
	`.trim(),
});
