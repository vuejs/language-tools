import type { Renders } from 'vue-component-type-helpers';
import type Item from './Item.vue';
import type Other from './Other.vue';

type A = Renders<typeof Item<number>>;
type B = Renders<typeof Other>;
export interface UnionSlots {
	default?: () => Renders<typeof Item<number> | typeof Other>[];
	separate?: () => (A | B)[];
	homogeneous?: () => A[] | B[];
	single?: () => A | B;
	nullable?: () => A | B | undefined;
	tuple?: () => readonly [A, B] | readonly [B, A];
	native?: () => (HTMLInputElement | HTMLButtonElement)[];
}
