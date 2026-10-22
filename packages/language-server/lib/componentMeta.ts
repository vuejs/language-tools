import { names, tsCodegen, type VueVirtualCode } from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import { getSelfComponentName } from '@vue/typescript-plugin/lib/requests/utils';
import type { TypeScript } from 'vue-component-meta/lib/typescript';

type Node = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).Node;
type SourceFile = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).SourceFile;
type Checker = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Checker;
type Symbol = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Symbol;

export interface ComponentExport {
	fileName: string;
	exportName: string;
}

/** The export of the component that `tag` refers to in a Vue file's template. */
export async function getComponentExport(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	virtualCode: VueVirtualCode,
	tag: string,
): Promise<ComponentExport | undefined> {
	const testNames = new Set([
		tag,
		camelize(tag),
		capitalize(camelize(tag)),
	]);
	const codegen = tsCodegen.get(virtualCode.ir);

	for (const importedName of codegen?.getImportedComponents() ?? []) {
		if (testNames.has(importedName)) {
			const node = searchDefaultImportIdentifier(ts, sourceFile, importedName);
			const symbol = node && await checker.getSymbolAtLocation(node);
			if (symbol) {
				return await findExport(ts, checker, symbol);
			}
		}
	}

	const selfName = getSelfComponentName(virtualCode);
	const self = { fileName: sourceFile.fileName, exportName: 'default' };
	const components = findNode(
		sourceFile,
		node => ts.isVariableDeclaration(node) && node.name.getText() === names.components,
	);
	if (components) {
		const type = await checker.getTypeAtLocation(components);
		const [firstName, ...restNames] = tag.split('.') as [string, ...string[]];
		let componentSymbol = await type.getProperty(firstName)
			?? await type.getProperty(camelize(firstName))
			?? await type.getProperty(capitalize(camelize(firstName)));
		for (const name of restNames) {
			componentSymbol = componentSymbol
				&& await (await checker.getTypeOfSymbolAtLocation(componentSymbol, components)).getProperty(name);
		}
		if (componentSymbol) {
			const target = await getRegisteredComponent(ts, checker, componentSymbol);
			return target && await findExport(ts, checker, target);
		}
		else if (selfName === capitalize(camelize(tag))) {
			return self;
		}
	}

	if (testNames.has(selfName)) {
		return self;
	}
}

/** The symbol that a `__VLS_components` property is registered with. */
async function getRegisteredComponent(ts: TypeScript, checker: Checker, property: Symbol) {
	for (const declaration of await Promise.all(property.declarations.map(handle => handle.resolve()))) {
		if (!declaration) {
			continue;
		}
		if (ts.isShorthandPropertyAssignment(declaration)) {
			return await checker.getShorthandAssignmentValueSymbol(declaration);
		}
		if (ts.isPropertyAssignment(declaration)) {
			return await checker.getSymbolAtLocation(declaration.initializer);
		}
		if (
			(ts.isPropertySignatureDeclaration(declaration) || ts.isPropertyDeclaration(declaration))
			&& declaration.type
			&& ts.isTypeQueryNode(declaration.type)
		) {
			return await checker.getSymbolAtLocation(declaration.type.exprName);
		}
	}
}

/** The module export that `symbol` (or the symbol it aliases) is exported as. */
async function findExport(ts: TypeScript, checker: Checker, symbol: Symbol): Promise<ComponentExport | undefined> {
	if (symbol.flags & ts.SymbolFlags.Alias) {
		symbol = await checker.getAliasedSymbol(symbol);
	}
	const declaration = await (symbol.valueDeclaration ?? symbol.declarations[0])?.resolve();
	if (!declaration) {
		return;
	}
	const fileName = declaration.getSourceFile().fileName;
	const moduleSymbol = await checker.getSymbolOfSourceFile(fileName);
	for (const exported of moduleSymbol ? await checker.getExportsOfModule(moduleSymbol) : []) {
		const target = exported.flags & ts.SymbolFlags.Alias ? await checker.getAliasedSymbol(exported) : exported;
		if (target.id === symbol.id) {
			return { fileName, exportName: exported.name };
		}
	}
}

function searchDefaultImportIdentifier(ts: TypeScript, sourceFile: SourceFile, name: string) {
	const node = findNode(sourceFile, node => ts.isImportDeclaration(node) && node.importClause?.name?.text === name);
	return node && ts.isImportDeclaration(node) ? node.importClause?.name : undefined;
}

function findNode(node: Node, predicate: (node: Node) => boolean): Node | undefined {
	return predicate(node) ? node : node.forEachChild(child => findNode(child, predicate));
}
