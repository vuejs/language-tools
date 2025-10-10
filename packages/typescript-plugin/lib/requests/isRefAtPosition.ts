/// <reference types="@volar/typescript" />

import { isCompletionEnabled, type Language, type SourceScript, type VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';

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

	const node = findPositionIdentifier(sourceFile, sourceFile, position + leadingOffset);
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

	function findPositionIdentifier(sourceFile: ts.SourceFile, node: ts.Node, offset: number) {
		let result: ts.Node | undefined;

		node.forEachChild(child => {
			if (!result) {
				if (child.end === offset && ts.isIdentifier(child)) {
					result = child;
				}
				else if (child.end >= offset && child.getStart(sourceFile) < offset) {
					result = findPositionIdentifier(sourceFile, child, offset);
				}
			}
		});

		return result;
	}
}
