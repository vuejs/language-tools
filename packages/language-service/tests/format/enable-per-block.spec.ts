import { defineFormatTest } from '../utils/format';

const snippet = `
<template>
<div />
</template>
<script>
if (true)
console.log('hello');
</script>
<style>
body {
color: red;
}
</style>`;

const units = {
	'vue.format.style.enabled': {
		description: 'disable style formatting',
		output: `
<template>
\t<div />
</template>
<script>
if (true)
\tconsole.log('hello');
</script>
<style>
body {
color: red;
}
</style>
`,
	},
	'vue.format.script.enabled': {
		description: 'disable script formatting',
		output: `
<template>
\t<div />
</template>
<script>
if (true)
console.log('hello');
</script>
<style>
body {
\tcolor: red;
}
</style>
`,
	},
	'vue.format.template.enabled': {
		description: 'disable template formatting',
		output: `
<template>
<div />
</template>
<script>
if (true)
\tconsole.log('hello');
</script>
<style>
body {
\tcolor: red;
}
</style>
`,
	},
};

for (const [setting, { description, output }] of Object.entries(units)) {
	const title = '#' + __filename.split('.')[0];
	defineFormatTest({
		title: title + ' (' + description + ')',
		languageId: 'vue',
		input: snippet.trim(),
		output: output.trim(),
		settings: { [setting]: false },
	});
}
