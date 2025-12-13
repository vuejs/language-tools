import type { VNode } from 'vue';

export interface MySlots {
	/**
	 * Default slot
	 */
	default: (props: { num: number }) => VNode[];
	'named-slot': (props: { str: string }) => VNode[];
	/**
	 * Slot with tags
	 * @deprecated do not use
	 */
	vbind: (props: { num: number; str: string }) => VNode[];
	'no-bind': () => VNode[];
}
