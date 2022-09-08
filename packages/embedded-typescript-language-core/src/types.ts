import type * as ts from 'typescript/lib/tsserverlibrary';

export type LanguageServiceHost = ts.LanguageServiceHost & {
	getTypeScriptModule(): typeof import('typescript/lib/tsserverlibrary');
	isTsPlugin?: boolean,
	isTsc?: boolean,
};
