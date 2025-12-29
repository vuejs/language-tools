<template>
	<div>
		<foo-bar class="class" />
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import FooBar from './component.vue';

export default defineComponent({
	name: 'SameComponent',

	components: {
		FooBar,
	},

	props: {
		fooBar: { // Almost the same name as component's name
			type: Boolean,
			default: false,
		},
	},
});
</script>
