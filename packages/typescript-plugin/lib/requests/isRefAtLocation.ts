/// <reference types="@volar/typescript" />

import { isCompletionEnabled, type Language, type SourceScript, type VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';

export function isRefAtLocation(
	ts: typeof import('typescript'),
	language: Language,
	program: ts.Program,
	sourceScript: SourceScript,
	virtualCode: VueVirtualCode,
	position: number,
	isTsPlugin: boolean,
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
	position += isTsPlugin ? sourceScript.snapshot.getLength() : 0;

	const sourceFile = program.getSourceFile(virtualCode.fileName);
	if (!sourceFile) {
		return false;
	}

	const node = findPositionIdentifier(sourceFile, sourceFile, position);
	if (!node) {
		return false;
	}

	const checker = program.getTypeChecker();
	const type = checker.getTypeAtLocation(node);
	const props = type.getProperties();

	return props.some(prop => prop.escapedName === 'value' && prop.flags & ts.SymbolFlags.Accessor);

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
