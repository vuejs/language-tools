import type { InitializationOptions } from '@volar/language-server';

export type VueInitializationOptions = InitializationOptions & {
	typescript: {
		tsdk: string;
	};
	vue?: {
		hybridMode?: boolean;
	};
};
