<script setup lang="ts">
declare function Comp(props: {
	onFooBar?: () => void;
}): void;
</script>

<template>
	<!-- @vue-expect-error -->
	<Comp @foo-bar="void 0" @fooBar="void 0" />
	<!-- @vue-expect-error -->
	<Comp @foo-bar.up="void 0" @fooBar.up="void 0" />
	<Comp @foo-bar.up="void 0" @fooBar.down="void 0" />
</template>
