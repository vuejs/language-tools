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
	`.trim(),
	output: `
<template>
	<div>
		<div>
		</div>
	</div>
</template>
	`.trim(),
});
