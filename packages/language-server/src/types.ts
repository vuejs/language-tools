import { InitializationOptions } from "@volar/language-server";

export type VueInitializationOptions = InitializationOptions & {
	typescript: {
		tsdk: string;
	}
	vue?: {
		/**
		 * @example ['vue1', 'vue2']
		 */
		additionalExtensions?: string[];
	};
};
