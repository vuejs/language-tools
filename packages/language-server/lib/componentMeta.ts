import { names, tsCodegen, type VueVirtualCode } from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import { getSelfComponentName } from '@vue/typescript-plugin/lib/requests/utils';
import type { TypeScript } from 'vue-component-meta';

type Node = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).Node;
type SourceFile = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).SourceFile;
type Checker = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Checker;
type Type = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Type;

/** The node and type of the component that `tag` refers to in a Vue file's template. */
export async function getComponentType(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	virtualCode: VueVirtualCode,
	tag: string,
): Promise<{ node: Node; type: Type } | undefined> {
	const testNames = new Set([
		tag,
		camelize(tag),
		capitalize(camelize(tag)),
	]);
	const codegen = tsCodegen.get(virtualCode.ir);

	for (const importedName of codegen?.getImportedComponents() ?? []) {
		if (testNames.has(importedName)) {
			const node = searchDefaultImportIdentifier(ts, sourceFile, importedName);
			if (node) {
				return {
					node,
					type: await checker.getTypeAtLocation(node),
				};
			}
		}
	}

	const selfName = getSelfComponentName(virtualCode);
	const components = await getVariableType(ts, checker, sourceFile, names.components);
	if (components) {
		const [firstName, ...restNames] = tag.split('.') as [string, ...string[]];
		let componentSymbol = await components.type.getProperty(firstName)
			?? await components.type.getProperty(camelize(firstName))
			?? await components.type.getProperty(capitalize(camelize(firstName)));
		if (componentSymbol) {
			let componentType = await checker.getTypeOfSymbolAtLocation(componentSymbol, components.node);
			for (const name of restNames) {
				componentSymbol = await componentType.getProperty(name);
				if (componentSymbol) {
					componentType = await checker.getTypeOfSymbolAtLocation(componentSymbol, components.node);
				}
			}
			return {
				node: components.node,
				type: componentType,
			};
		}
		else if (selfName === capitalize(camelize(tag))) {
			return await getVariableType(ts, checker, sourceFile, names.export);
		}
	}

	if (testNames.has(selfName)) {
		return await getVariableType(ts, checker, sourceFile, names.export);
	}
}

async function getVariableType(ts: TypeScript, checker: Checker, sourceFile: SourceFile, name: string) {
	const node = findNode(sourceFile, node => ts.isVariableDeclaration(node) && node.name.getText() === name);
	if (node) {
		return {
			node,
			type: await checker.getTypeAtLocation(node),
		};
	}
}

function searchDefaultImportIdentifier(ts: TypeScript, sourceFile: SourceFile, name: string) {
	const node = findNode(sourceFile, node => ts.isImportDeclaration(node) && node.importClause?.name?.text === name);
	return node && ts.isImportDeclaration(node) ? node.importClause?.name : undefined;
}

function findNode(node: Node, predicate: (node: Node) => boolean): Node | undefined {
	return predicate(node) ? node : node.forEachChild(child => findNode(child, predicate));
}
