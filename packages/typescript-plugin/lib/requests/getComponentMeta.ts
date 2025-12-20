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

	const meta = _get(
		ts,
		checker,
		ts.createPrinter(),
		language,
		componentType.node,
		componentType.type,
		false,
	);

	for (const key of ['props', 'events', 'slots', 'exposed'] as const) {
		for (const item of meta[key]) {
			// @ts-expect-error https://typescript.tv/errors/ts2790
			delete item.schema;
		}
	}

	return meta;
}
