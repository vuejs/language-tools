/// <reference types="@volar/typescript" />

import { toGeneratedOffset } from '@volar/typescript/lib/node/transform';
import { isCompletionEnabled, type Language, type SourceScript, type VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import { forEachTouchingNode } from './utils';

export function isRefAtPosition(
	ts: typeof import('typescript'),
	language: Language,
	program: ts.Program,
	sourceScript: SourceScript<string>,
	virtualCode: VueVirtualCode,
	position: number,
): boolean {
	const serviceScript = sourceScript.generated!.languagePlugin.typescript?.getServiceScript(virtualCode);
	if (!serviceScript) {
		return false;
	}

	const position2 = toGeneratedOffset(language, serviceScript, sourceScript, position, isCompletionEnabled);
	if (!position2) {
		return false;
	}

	const sourceFile = program.getSourceFile(virtualCode.fileName);
	if (!sourceFile) {
		return false;
	}

	let node: ts.Node | undefined;
	for (const child of forEachTouchingNode(ts, sourceFile, position2)) {
		if (ts.isIdentifier(child)) {
			node = child;
			break;
		}
	}
	if (!node) {
		return false;
	}

	const checker = program.getTypeChecker();
	const type = checker.getTypeAtLocation(node);
	const props = type.getProperties();

	return props.some(prop =>
		prop.declarations?.some(decl =>
			ts.isPropertySignature(decl)
			&& ts.isComputedPropertyName(decl.name)
			&& ts.isIdentifier(decl.name.expression)
			&& decl.name.expression.text === 'RefSymbol'
		)
	);
}
