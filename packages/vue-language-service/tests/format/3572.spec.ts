import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<template>
	<Foo v-for="meow in 13">
		<template #default="{ row }: { row: Row }" />
	</Foo>
</template>
	`.trim(),
});
