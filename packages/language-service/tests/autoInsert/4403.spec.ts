import { defineAutoInsertTest } from '../utils/autoInsert';

const issue = '#' + __filename.split('.')[0];

defineAutoInsertTest({
	title: `${issue} auto insert inside interpolations`,
	languageId: 'vue',
	input: `
<template>
	{{ "<div|" }}
</template>
`,
	insertedText: '>',
	output: undefined,
});

defineAutoInsertTest({
	title: `${issue} still completes HTML tags in plain template regions`,
	languageId: 'vue',
	input: `
<template>
	<div|
</template>
`,
	insertedText: '>',
	output: '$0</div>',
});

defineAutoInsertTest({
	title: `${issue} completes HTML tags when bracket are inside HTML comments`,
	languageId: 'vue',
	input: `
<template>
<!-- {{ -->
<div|
<!-- }}-->
</template>
`,
	insertedText: '>',
	output: '$0</div>',
});

defineAutoInsertTest({
	title: `${issue} completes closing tags even if previous interpolation contains HTML strings`,
	languageId: 'vue',
	input: `
<template>
<div>{{ "<div></div>" }}<|
</template>
`,
	insertedText: '/',
	output: 'div>',
});

defineAutoInsertTest({
	title: `${issue} avoids closing tags spawned from string literals when typing \`</\``,
	languageId: 'vue',
	input: `
<template>
	{{ "<div>" }}<|
</template>
`,
	insertedText: '/',
	output: undefined,
});
