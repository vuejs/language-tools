<template>
	<Foo :items="items">
		<template #content="{ item }">
			<div>{{ item.name }}</div>
		</template>
	</Foo>
</template>

<script setup lang="ts">
import Foo from './Foo.vue';

type ShowCaseItem = {
	name: string;
	icon: string;
	action: () => void;
	index: number;
};

const items: ShowCaseItem[] = [
	{
		name: 'Instagram Follow Up',
		action: () => {
			console.log('open IG');
		},
		icon: 'instagramIcon',
		index: 0,
	},
	{
		name: 'Email Follow Up',
		action: () => {
			console.log('open email');
		},
		icon: 'envelopeIcon',
		index: 1,
	},
]
</script>
