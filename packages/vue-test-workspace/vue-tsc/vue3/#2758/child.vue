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
		[K in `cell:${string}`]?: (_: { value: T[keyof T] }) => any;
	} & {
		default?: (_: Record<string, any>) => any;
	}
>();
</script>
