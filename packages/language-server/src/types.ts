import { InitializationOptions } from "@volar/language-server";

export type VueInitializationOptions = InitializationOptions & {
	typescript: {
		tsdk?: string;
		tsdkUrl?: string;
	}
	vue?: {
		/**
		 * @example ['vue1', 'vue2']
		 */
		additionalExtensions?: string[];
		hybridMode?: boolean;
	};
};
