<script setup lang="ts">
let Comp: new () => {
	$props: {};
	$slots: {
		[key: string]: string;
	};
};
</script>

<template>
	<Comp>
		<template v-slot:slotName></template>
	</Comp>
</template>
