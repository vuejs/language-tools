import { names, tsCodegen, type VueVirtualCode } from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import * as path from 'path-browserify';
import type * as ts from 'typescript';

export function getComponentType(
	ts: typeof import('typescript'),
	checker: ts.TypeChecker,
	sourceFile: ts.SourceFile,
	{ fileName, ir }: VueVirtualCode,
	tag: string,
): {
	node: ts.Node;
	type: ts.Type;
} | undefined {
	const testNames = new Set([
		tag,
		camelize(tag),
		capitalize(camelize(tag)),
	]);
	const codegen = tsCodegen.get(ir);

	for (const importedName of codegen?.getImportedComponents() ?? []) {
		if (testNames.has(importedName)) {
			const node = searchDefaultImportIdentifier(ts, sourceFile, importedName);
			if (node) {
				return {
					node,
					type: checker.getTypeAtLocation(node),
				};
			}
		}
	}

	const components = getVariableType(ts, checker, sourceFile, names.components);
	if (components) {
		const nameParts = tag.split('.') as [string, ...string[]];
		let componentSymbol = components.type.getProperty(nameParts[0])
			?? components.type.getProperty(camelize(nameParts[0]))
			?? components.type.getProperty(capitalize(camelize(nameParts[0])));
		if (componentSymbol) {
			let componentType = checker.getTypeOfSymbolAtLocation(componentSymbol, components.node);
			for (let i = 1; i < nameParts.length; i++) {
				componentSymbol = componentType.getProperty(nameParts[i]!);
				if (componentSymbol) {
					componentType = checker.getTypeOfSymbolAtLocation(componentSymbol, components.node);
				}
			}
			if (componentType) {
				return {
					node: components.node,
					type: componentType,
				};
			}
		}
		else {
			const name = getSelfComponentName(fileName);
			if (name === capitalize(camelize(tag))) {
				return getVariableType(ts, checker, sourceFile, names.export);
			}
		}
	}

	const selfName = getSelfComponentName(fileName);
	if (testNames.has(selfName)) {
		return getVariableType(ts, checker, sourceFile, names.export);
	}
}

export function getSelfComponentName(fileName: string) {
	const baseName = path.basename(fileName);
	return capitalize(camelize(baseName.slice(0, baseName.lastIndexOf('.'))));
}

export function getVariableType(
	ts: typeof import('typescript'),
	checker: ts.TypeChecker,
	sourceFile: ts.SourceFile,
	name: string,
) {
	const node = searchVariableDeclarationNode(ts, sourceFile, name);
	if (node) {
		return {
			node: node,
			type: checker.getTypeAtLocation(node),
		};
	}
}

function searchVariableDeclarationNode(
	ts: typeof import('typescript'),
	sourceFile: ts.SourceFile,
	name: string,
) {
	let result: ts.VariableDeclaration | undefined;
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

function searchDefaultImportIdentifier(
	ts: typeof import('typescript'),
	sourceFile: ts.SourceFile,
	name: string,
) {
	let result: ts.Identifier | undefined;
	walk(sourceFile);
	return result;

	function walk(node: ts.Node) {
		if (result) {
			return;
		}
		else if (
			ts.isImportDeclaration(node)
			&& node.importClause?.name?.text === name
		) {
			result = node.importClause.name;
		}
		else {
			node.forEachChild(walk);
		}
	}
}

export function hasBooleanType(ts: typeof import('typescript'), type: ts.Type): boolean {
	if (type.flags & ts.TypeFlags.BooleanLike) {
		return true;
	}
	if (type.isUnionOrIntersection()) {
		return type.types.some(type => hasBooleanType(ts, type));
	}
	return false;
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
