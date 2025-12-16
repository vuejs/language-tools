import type { Language, VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import type { ComponentMeta } from 'vue-component-meta';
import { getComponentMeta as _get } from 'vue-component-meta/lib/componentMeta';
import { getComponentType } from './utils';

export function getComponentMeta(
	ts: typeof import('typescript'),
	program: ts.Program,
	language: Language<string>,
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
		program,
		ts.createPrinter(),
		virtualCode.vueCompilerOptions,
		language,
		sourceFile,
		componentType.node,
		componentType.type,
		false,
	);
}
