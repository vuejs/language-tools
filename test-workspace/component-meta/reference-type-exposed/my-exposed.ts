import type { Ref } from 'vue';

export interface MyExposed {
	/**
	 * a counter string
	 */
	counter: Ref<string>;
	/**
	 * an oldCounter string
	 * @deprecated use counter instead
	 */
	oldCounter: Ref<string>;
}
