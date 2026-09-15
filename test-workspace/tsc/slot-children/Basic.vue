<script setup lang="ts">
import type { VNode } from 'vue';
import type Item from './Item.vue';
import type Other from './Other.vue';
import type { Renders } from 'vue-component-type-helpers';
defineSlots<{
	default?: () => (typeof Item<number>)[];
	single?: () => typeof Item<number>;
	pair?: () => [typeof Item<number>, typeof Item<number>];
	input?: () => HTMLInputElement;
	inputs?: () => HTMLInputElement[];
	mixed?: () => (HTMLInputElement | typeof Item<number>)[];
	text?: () => string;
	tuple?: () => readonly [HTMLInputElement, HTMLButtonElement];
	variadic?: () => readonly [HTMLInputElement, ...HTMLButtonElement[], HTMLInputElement];
	positioned?: () => readonly [HTMLInputElement, typeof Other];
	positionedUnion?: () => readonly [typeof Other, HTMLButtonElement] | readonly [HTMLInputElement, typeof Other];
	nodes?: () => VNode[];
	scoped?: (props: { value: number }) => Renders<unknown, { value: number }>[];
	never?: () => never;
}>();
</script>
