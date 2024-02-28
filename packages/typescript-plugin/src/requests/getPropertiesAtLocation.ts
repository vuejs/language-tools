import { getProject } from './utils';
import type * as ts from 'typescript';

export function getPropertiesAtLocation(fileName: string, position: number, isTsPlugin: boolean = true) {

	const match = getProject(fileName);
	if (!match) {
		return;
	}

	const [info, files, ts] = match;
	const languageService = info.languageService;
	const program = languageService.getProgram();
	if (!program) {
		return;
	}

	const sourceFile = program.getSourceFile(fileName);
	if (!sourceFile) {
		return;
	}

	const volarFile = files.get(fileName);
	const node = findPositionIdentifier(sourceFile, sourceFile, position + (isTsPlugin ? (volarFile?.snapshot.getLength() ?? 0) : 0));
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
