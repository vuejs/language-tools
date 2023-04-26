import { LanguageServerInitializationOptions } from "@volar/language-server";

export type VueServerInitializationOptions = LanguageServerInitializationOptions & {
	json?: {
		customBlockSchemaUrls?: Record<string, string>;
	};
	/**
	 * @example ['vue1', 'vue2']
	 */
	additionalExtensions?: string[];
};
