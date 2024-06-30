export type VueInitializationOptions = {
	typescript: {
		tsdk: string;
	};
	vue?: {
		hybridMode?: boolean;
	};
};

export * from '@volar/language-server/lib/types';
export * from '@vue/language-service/lib/types';
