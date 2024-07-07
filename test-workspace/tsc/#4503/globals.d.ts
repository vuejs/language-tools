import type globalcomp from './globalcomp.vue';

declare module 'vue' {
	export interface GlobalComponents {
		globalcomp: typeof globalcomp
	}
}

export { };
