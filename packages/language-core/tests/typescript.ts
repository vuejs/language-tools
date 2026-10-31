import type { API } from 'typescript/sync' with { 'resolution-mode': 'import' };
import type { TypeScript } from '../lib/types';

const { API: TypeScriptAPI }: { API: typeof API } = require('typescript/sync');
let api: API | undefined;

export const ts: TypeScript = {
	...require('typescript/ast'),
	createSourceFile(fileName, sourceText, _languageVersion, _setParentNodes, scriptKind) {
		const retained = (api ??= new TypeScriptAPI()).createSourceFile(fileName, sourceText, { scriptKind });
		retained.dispose();
		return retained.sourceFile;
	},
};

export function createSnapshot(text: string) {
	return {
		getText: (start: number, end: number) => text.slice(start, end),
		getLength: () => text.length,
		getChangeRange: () => undefined,
	};
}
