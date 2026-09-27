import { defineComponent, type SlotsType } from 'vue';

export default defineComponent({
	slots: Object as SlotsType<{
		/**
		 * Default slot
		 */
		default: { num: number };
		'named-slot'?: { str: string };
	}>,
});
