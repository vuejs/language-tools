import { names, tsCodegen, type VueVirtualCode } from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import { getSelfComponentName } from '@vue/typescript-plugin/lib/requests/utils';
import type { TypeScript } from 'vue-component-meta';

type Node = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).Node;
type SourceFile = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).SourceFile;
type TypeNode = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).TypeNode;
type Checker = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Checker;
type Symbol = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Symbol;
type Type = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Type;

/** The type of the component that `tag` refers to in a Vue file's template, and its declaration when known. */
export async function getComponentType(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	virtualCode: VueVirtualCode,
	tag: string,
): Promise<{ node: Node | undefined; type: Type } | undefined> {
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
	const components = findVariable(ts, sourceFile, names.components);
	if (components) {
		const [firstName, ...restNames] = tag.split('.') as [string, ...string[]];
		const componentsType = await checker.getTypeAtLocation(components);
		let symbol = await componentsType.getProperty(firstName)
			?? await componentsType.getProperty(camelize(firstName))
			?? await componentsType.getProperty(capitalize(camelize(firstName)));
		if (!symbol && restNames.length) {
			// namespaced tags (e.g. `<Foo.Bar>`) refer to bindings of the script setup scope
			symbol = await checker.resolveName(firstName, ts.SymbolFlags.Value, components);
		}
		for (const name of restNames) {
			symbol = symbol && await (await getTypeOfSymbol(ts, checker, symbol, components)).getProperty(name);
		}
		if (symbol) {
			return {
				node: await getComponentDeclaration(ts, checker, symbol),
				type: await getTypeOfSymbol(ts, checker, symbol, components),
			};
		}
		else if (selfName === capitalize(camelize(tag))) {
			return getSelf();
		}
	}

	if (testNames.has(selfName)) {
		return getSelf();
	}

	async function getSelf() {
		const node = findVariable(ts, sourceFile, names.export);
		return node && {
			node,
			type: await checker.getTypeAtLocation(node),
		};
	}
}

async function getTypeOfSymbol(ts: TypeScript, checker: Checker, symbol: Symbol, location: Node) {
	if (symbol.flags & ts.SymbolFlags.Alias) {
		symbol = await checker.getAliasedSymbol(symbol);
	}
	return await checker.getTypeOfSymbolAtLocation(symbol, location);
}

/** Follows aliases and the registrations of `__VLS_components` to the declaration of a component. */
async function getComponentDeclaration(ts: TypeScript, checker: Checker, symbol: Symbol): Promise<Node | undefined> {
	if (symbol.flags & ts.SymbolFlags.Alias) {
		symbol = await checker.getAliasedSymbol(symbol);
	}
	const declaration = await (symbol.valueDeclaration ?? symbol.declarations[0])?.resolve();
	if (!declaration) {
		return;
	}
	let target: Symbol | undefined;
	if (ts.isShorthandPropertyAssignment(declaration)) {
		target = await checker.getShorthandAssignmentValueSymbol(declaration);
	}
	else if (ts.isPropertyAssignment(declaration)) {
		target = await checker.getSymbolAtLocation(declaration.initializer);
	}
	else if (
		(ts.isPropertySignatureDeclaration(declaration) || ts.isPropertyDeclaration(declaration))
		&& declaration.type
	) {
		target = await getSymbolOfTypeNode(ts, checker, declaration.type);
	}
	return target ? await getComponentDeclaration(ts, checker, target) : declaration;
}

/** The symbol whose type `typeof X` or `typeof import('./X.vue')['default']` refers to. */
async function getSymbolOfTypeNode(ts: TypeScript, checker: Checker, node: TypeNode) {
	if (ts.isTypeQueryNode(node)) {
		return await checker.getSymbolAtLocation(node.exprName);
	}
	if (
		ts.isIndexedAccessTypeNode(node)
		&& ts.isLiteralTypeNode(node.indexType)
		&& ts.isStringLiteral(node.indexType.literal)
	) {
		const objectType = await checker.getTypeFromTypeNode(node.objectType);
		return await objectType.getProperty(node.indexType.literal.text);
	}
}

export function findVariable(ts: TypeScript, sourceFile: SourceFile, name: string) {
	return findNode(sourceFile, node => ts.isVariableDeclaration(node) && node.name.getText() === name);
}

function searchDefaultImportIdentifier(ts: TypeScript, sourceFile: SourceFile, name: string) {
	const node = findNode(sourceFile, node => ts.isImportDeclaration(node) && node.importClause?.name?.text === name);
	return node && ts.isImportDeclaration(node) ? node.importClause?.name : undefined;
}

function findNode(node: Node, predicate: (node: Node) => boolean): Node | undefined {
	return predicate(node) ? node : node.forEachChild(child => findNode(child, predicate));
}
