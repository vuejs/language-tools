import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<template>
<!-- hello -->
<img alt="Vue logo" src="./assets/logo.png" />
<HelloWorld msg="Hello Vue 3 + TypeScript + Vite" />
</template>
	`.trim(),
	output: `
<template>
	<!-- hello -->
	<img alt="Vue logo" src="./assets/logo.png" />
	<HelloWorld msg="Hello Vue 3 + TypeScript + Vite" />
</template>
	`.trim(),
});
