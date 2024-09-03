declare module 'vue3.5' {
	export interface GlobalComponents {
		GenericGlobal: typeof import('./generic.vue')['default'];
	}
}

export { };
