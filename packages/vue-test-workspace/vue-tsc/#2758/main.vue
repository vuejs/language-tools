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
		[K in `cell:${string}`]: { value: T[keyof T] };
	} & {
		default: Record<string, any>;
	}
>();
</script>
