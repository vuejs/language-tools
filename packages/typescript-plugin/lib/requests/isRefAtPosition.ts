/// <reference types="@volar/typescript" />

import { isCompletionEnabled, type Language, type SourceScript, type VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import { forEachTouchingNode } from './utils';

export function isRefAtPosition(
	ts: typeof import('typescript'),
	language: Language,
	program: ts.Program,
	sourceScript: SourceScript,
	virtualCode: VueVirtualCode,
	position: number,
	leadingOffset: number = 0,
): boolean {
	const serviceScript = sourceScript.generated!.languagePlugin.typescript?.getServiceScript(virtualCode);
	if (!serviceScript) {
		return false;
	}

	let mapped = false;
	for (const [_sourceScript, map] of language.maps.forEach(serviceScript.code)) {
		for (const [position2, mapping] of map.toGeneratedLocation(position)) {
			if (isCompletionEnabled(mapping.data)) {
				position = position2;
				mapped = true;
				break;
			}
		}
		if (mapped) {
			break;
		}
	}
	if (!mapped) {
		return false;
	}

	const sourceFile = program.getSourceFile(virtualCode.fileName);
	if (!sourceFile) {
		return false;
	}

	let node: ts.Identifier | undefined;
	for (const child of forEachTouchingNode(ts, sourceFile, position + leadingOffset)) {
		if (ts.isIdentifier(child)) {
			node = child;
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
