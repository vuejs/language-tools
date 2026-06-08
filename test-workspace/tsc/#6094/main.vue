<script setup lang="ts">
declare function Comp(props: {
	onFooBar?: () => void;
}): void;
</script>

<template>
	<!-- @vue-expect-error -->
	<Comp @foo-bar="void 0" @fooBar="void 0" />
</template>
