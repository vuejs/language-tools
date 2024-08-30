declare module 'vue' {
	export interface GlobalComponents {
		Generic: typeof import('./generic.vue')['default'];
	}
}
