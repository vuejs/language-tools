import { InitializationOptions } from "@volar/language-server";

export type VueServerInitializationOptions = InitializationOptions & {
	json?: {
		customBlockSchemaUrls?: Record<string, string>;
	};
	/**
	 * @example ['vue1', 'vue2']
	 */
	additionalExtensions?: string[];
};
