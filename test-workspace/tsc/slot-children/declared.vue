<script setup lang="ts">
import Basic from './Basic.vue';
defineSlots<{
	default?: () => HTMLInputElement | undefined;
	empty?: () => [];
	wrong?: () => HTMLButtonElement | undefined;
}>();
</script>
<template>
	<Basic>
		<template #input>
			<slot>
				<input />
			</slot>
		</template>
	</Basic>
	<Basic>
		<template #input>
			<slot name="empty">
				<input />
			</slot>
		</template>
	</Basic>
	<Basic>
		<!-- @vue-expect-error -->
		<template #input>
			<slot name="wrong">
				<input />
			</slot>
		</template>
	</Basic>
	<Basic>
		<!-- @vue-expect-error -->
		<template #input>
			<slot>
				<button />
			</slot>
		</template>
	</Basic>
</template>
