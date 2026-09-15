import type { Renders } from 'vue-component-type-helpers';
import type Item from './Item.vue';
export interface NamedSlots<T> {
	default?: () => Renders<typeof Item<T>>[];
	input?: () => HTMLInputElement;
	pair?: () => readonly [HTMLInputElement, HTMLButtonElement];
	text?: () => string;
	empty?: () => [];
	props?: () => Renders<unknown, { value: T }>;
	exact?: () => Renders<typeof Item<T>, { value: T }>;
	optional?: () => HTMLInputElement | undefined;
	any?: () => any;
}
export type Slots<T> = NamedSlots<T>;
