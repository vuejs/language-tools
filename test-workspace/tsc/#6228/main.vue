<script setup lang="ts">
import Child from './child.vue';
import GenericChild from './generic.vue';
import { exactType } from '../shared';

const url = 'a/b';
const member = {} as { name: string } | undefined;
</script>

<template>
	<Child foo="https://example.com/a/b" />
	<Child :foo="`https://example.com/${url}/100`" />
	<Child :foo="`${/[//]/.source}/${`https://example.com/${url}`}`" />
	<Child
		:foo="
			/* https://example.com/comment */
			'https://example.com/a/b' // trailing comment with */
		"
	/>
	<Child
		:foo="
			// a comment
			'x'
		"
	/>
	<Child :foo="`first
second`" />
	<Child :foo="`first\\
`" />
	<GenericChild :foo="`$\
{missing}`" :check="value => exactType(value, '${missing}' as const)" />
	<template v-if="member">
		<Child :foo="`https://example.com/${member.name}`" />
		{{ member.name }}
	</template>
	<!-- @vue-expect-error -->
	<Child
		:foo="
			// a comment
			1
		"
	/>
</template>
