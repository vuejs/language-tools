import type { Language, SourceScript, VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import type { ComponentMeta } from 'vue-component-meta';
import { getComponentMeta as _get } from 'vue-component-meta/lib/componentMeta';
import { getComponentType } from './utils';

export function getComponentMeta(
	ts: typeof import('typescript'),
	program: ts.Program,
	language: Language,
	getSourceScript: (fileName: string) => SourceScript | undefined,
	sourceFile: ts.SourceFile,
	virtualCode: VueVirtualCode,
	tag: string,
): ComponentMeta | undefined {
	const checker = program.getTypeChecker();
	const componentType = getComponentType(ts, checker, sourceFile, virtualCode, tag);
	if (!componentType) {
		return;
	}
	return _get(
		ts,
		checker,
		ts.createPrinter(),
		language,
		getSourceScript,
		componentType.node,
		componentType.type,
		false,
	);
}
