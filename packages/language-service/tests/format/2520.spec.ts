import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<template>
<pre>
<code>
	const foo = 'bar'
</code>
	</pre>
</template>
	`.trim(),
	output: `
<template>
	<pre>
<code>
	const foo = 'bar'
</code>
	</pre>
</template>
	`.trim(),
	settings: {
		'html.format.contentUnformatted': 'pre',
	},
});
