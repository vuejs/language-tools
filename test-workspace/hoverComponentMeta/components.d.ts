export {};

declare module 'vue' {
	export interface GlobalComponents {
		GlobalChild: typeof import('./Child.vue')['default'];
		GlobalTsChild: typeof import('./tsChild')['TsChild'];
	}
}
