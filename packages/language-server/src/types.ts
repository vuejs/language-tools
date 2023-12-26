import { InitializationOptions } from "@volar/language-server";

export type VueInitializationOptions = InitializationOptions & {
	vue?: {
		/**
		 * @example ['vue1', 'vue2']
		 */
		additionalExtensions?: string[];
		hybridMode?: boolean;
	};
};
