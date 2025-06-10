export enum TagNameCasing {
	Kebab,
	Pascal,
}

export enum AttrNameCasing {
	Kebab,
	Camel,
}

export const commands = {
	parseSfc: 'vue.parseSfc',
};

// only export types of depend packages
export * from '@volar/language-service/lib/types';
export * from '@vue/language-core/lib/types';
