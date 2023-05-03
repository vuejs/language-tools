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
		<template v-slot:slot-name></template>
	</Comp>
</template>
