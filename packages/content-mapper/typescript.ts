import type * as TypeScript from 'typescript';

let loaded: typeof TypeScript | undefined;

export function loadTypeScript(): typeof TypeScript {
	return loaded ??= require(process.env.VUE_CONTENT_MAPPER_TYPESCRIPT ?? 'typescript');
}
