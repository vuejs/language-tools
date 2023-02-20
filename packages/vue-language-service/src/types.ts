export enum TagNameCasing {
	Kebab,
	Pascal,
}

export enum AttrNameCasing {
	Kebab,
	Camel,
}

// only export types of depend packages
export * from '@volar/language-service/out/types';
export * from '@volar/vue-language-core/out/types';
