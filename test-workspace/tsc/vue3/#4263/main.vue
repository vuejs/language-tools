<template>
	<SomeComponent some-prop>
		<!-- @vue-ignore -->
		<template #item="{ item: itemSlot }">
			<slot name="item" :item="(itemSlot as any)"></slot>
		</template>
	</SomeComponent>

	<!-- @vue-ignore -->
	<SomeComponent some-prop #item="{ item: itemSlot }">
		<slot name="item" :item="(itemSlot as any)"></slot>
	</SomeComponent>

	<!-- @vue-ignore -->
	<SomeComponent some-prop #item="{ item: itemSlot }"></SomeComponent>
	<!-- @vue-expect-error -->
	<SomeComponent some-prop #item="{ item: itemSlot }"></SomeComponent>
</template>

<script setup lang="ts">
declare const SomeComponent: new () => {
	$slots: {
		item(props: {}): any;
	};
};
</script>
