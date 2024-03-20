import type { InitializationOptions } from "@volar/language-server";

export type VueInitializationOptions = InitializationOptions & {
	typescript: {
		tsdk: string;
	};
	vue?: {
		hybridMode?: boolean;
		/**
		 * @example ['vue1', 'vue2']
		 */
		additionalExtensions?: string[];
	};
};
