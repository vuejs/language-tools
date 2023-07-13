import { InitializationOptions } from "@volar/language-server";

export type VueServerInitializationOptions = InitializationOptions & {
	/**
	 * @example ['vue1', 'vue2']
	 */
	additionalExtensions?: string[];
};
