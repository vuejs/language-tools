import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<template>
	<div>
		<div>
		</div>
	</div>
</template>

<script>
export { }
</script>

<style>
.foo {
	color: #000;
}
</style>
	`.trim(),
	output: `
<template>
<div>
	<div>
	</div>
</div>
</template>

<script>
	export { }
</script>

<style>
	.foo {
		color: #000;
	}
</style>
	`.trim(),
	settings: {
		'vue.format.initialIndent.template': false,
		'vue.format.initialIndent.script': true,
		'vue.format.initialIndent.style': true,
	},
});
