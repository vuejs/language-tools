/// <reference types="@volar/typescript" />

import { isCompletionEnabled, type Language, type SourceScript, type VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';

export function getPropertiesAtLocation(
	ts: typeof import('typescript'),
	language: Language,
	program: ts.Program,
	sourceScript: SourceScript,
	virtualCode: VueVirtualCode,
	position: number,
): string[] {
	const virtualScript = sourceScript.generated!.languagePlugin.typescript?.getServiceScript(virtualCode);
	if (!virtualScript) {
		return [];
	}

	let mapped = false;
	for (const [_sourceScript, map] of language.maps.forEach(virtualScript.code)) {
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
		return [];
	}
	position += sourceScript.snapshot.getLength();

	const sourceFile = program.getSourceFile(virtualCode.fileName);
	if (!sourceFile) {
		return [];
	}

	const node = findPositionIdentifier(sourceFile, sourceFile, position);
	if (!node) {
		return [];
	}

	const checker = program.getTypeChecker();
	const type = checker.getTypeAtLocation(node);
	const props = type.getProperties();

	return props.map(prop => prop.name);

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
