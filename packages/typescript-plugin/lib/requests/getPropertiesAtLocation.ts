import { isCompletionEnabled } from '@vue/language-core';
import type * as ts from 'typescript';
import type { RequestContext } from './types';

export function getPropertiesAtLocation(
	this: RequestContext,
	fileName: string,
	position: number
) {
	const { languageService, language, typescript: ts, isTsPlugin, getFileId } = this;

	// mapping
	const file = language.scripts.get(getFileId(fileName));
	if (file?.generated) {
		const virtualScript = file.generated.languagePlugin.typescript?.getServiceScript(file.generated.root);
		if (!virtualScript) {
			return;
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
			return;
		}
		if (isTsPlugin) {
			position += file.snapshot.getLength();
		}
	}

	const program = languageService.getProgram()!;
	const sourceFile = program.getSourceFile(fileName);
	if (!sourceFile) {
		return;
	}

	const node = findPositionIdentifier(sourceFile, sourceFile, position);
	if (!node) {
		return;
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
