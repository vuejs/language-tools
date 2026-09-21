<script setup lang="ts">
interface SharedProps {
	size?: 'sm' | 'md' | 'lg';
}

interface NativeProps extends SharedProps {
	as?: 'button';
	type?: 'button' | 'submit';
	href?: never;
}

interface LinkProps extends SharedProps {
	as: 'a';
	href: string;
	type?: never;
}

type Props = NativeProps | LinkProps;

withDefaults(defineProps<Props>(), {
	as: 'button',
	type: 'button',
	size: 'md',
});
</script>

<template>
	<slot />
</template>
