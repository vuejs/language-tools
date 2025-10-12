import { camelize, capitalize } from '@vue/shared';
import * as path from 'path-browserify';
import type * as ts from 'typescript';

export function getSelfComponentName(fileName: string) {
	const baseName = path.basename(fileName);
	return capitalize(camelize(baseName.slice(0, baseName.lastIndexOf('.'))));
}

export function getVariableType(
	ts: typeof import('typescript'),
	program: ts.Program,
	fileName: string,
	name: string,
) {
	const tsSourceFile = program.getSourceFile(fileName);
	if (tsSourceFile) {
		const checker = program.getTypeChecker();
		const node = searchVariableDeclarationNode(ts, tsSourceFile, name);
		if (node) {
			return {
				node: node,
				type: checker.getTypeAtLocation(node),
			};
		}
	}
}

function searchVariableDeclarationNode(
	ts: typeof import('typescript'),
	sourceFile: ts.SourceFile,
	name: string,
) {
	let result: ts.Node | undefined;
	walk(sourceFile);
	return result;

	function walk(node: ts.Node) {
		if (result) {
			return;
		}
		else if (ts.isVariableDeclaration(node) && node.name.getText() === name) {
			result = node;
		}
		else {
			node.forEachChild(walk);
		}
	}
}

export function* forEachTouchingNode(
	ts: typeof import('typescript'),
	sourceFile: ts.SourceFile,
	position: number,
) {
	yield* binaryVisit(ts, sourceFile, sourceFile, position);
}

function* binaryVisit(
	ts: typeof import('typescript'),
	sourceFile: ts.SourceFile,
	node: ts.Node,
	position: number,
): Generator<ts.Node> {
	const nodes: ts.Node[] = [];
	ts.forEachChild(node, child => {
		nodes.push(child);
	});

	let left = 0;
	let right = nodes.length - 1;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const node = nodes[mid]!;

		if (position > node.end) {
			left = mid + 1;
		}
		else if (position < node.getStart(sourceFile)) {
			right = mid - 1;
		}
		else {
			yield node;
			yield* binaryVisit(ts, sourceFile, node, position);
			return;
		}
	}
}
