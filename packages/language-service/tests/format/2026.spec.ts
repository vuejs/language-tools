import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	formatsTypeScript: true,
	languageId: 'vue',
	input: `
<template>
<span :class="['class1','class2',{'class3':!modelValue}]">{{
  $i18n('i18n-key')}}</span>
</template>
	`.trim(),
	output: `
<template>
	<span :class="['class1', 'class2', { 'class3': !modelValue }]">{{
		$i18n('i18n-key') }}</span>
</template>
	`.trim(),
});
