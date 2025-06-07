export type VueInitializationOptions = {
	typescript: {
		tsdk: string;
		tsserverRequestCommand?: string | [request: string, response: string];
	};
};

export * from '@volar/language-server/lib/types';
export * from '@vue/language-service/lib/types';

