declare module 'vue' {
	export interface GlobalComponents {
		GenericGlobal: typeof import('./generic.vue')['default'];
	}
}

export { };
