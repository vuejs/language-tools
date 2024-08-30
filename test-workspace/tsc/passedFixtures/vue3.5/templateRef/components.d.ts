declare module 'vue3.5' {
	export interface GlobalComponents {
		Generic: typeof import('./generic.vue')['default'];
	}
}

export { };
