<template>
	<slot />
	<template v-for="(value, key) of ({} as T)">
		<slot
		v-if="typeof key === 'string'"
		:name="`cell:${key}`"
		:value="value"
		/>
	</template>
</template>

<script lang="ts" setup generic="T extends Record<string, string>">
defineSlots<
	{
		[K in `cell:${string}`]?: (props: { value: T[keyof T] }) => any;
	} & {
		default?: (props: Record<string, any>) => any;
	}
>();
</script>
