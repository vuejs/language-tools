import {
	forEachElementNode,
	getSelfComponentName,
	type Language,
	names,
	type SourceScript,
	tsCodegen,
	type VueCodeInformation,
	type VueVirtualCode,
} from '@vue/language-core';
import type { AutoImportComponent, ComponentPropInfo, ExtractPropsInfo } from '@vue/language-service/lib/requests';
import { camelize, capitalize } from '@vue/shared';
import * as path from 'node:path';
import type { URI } from 'vscode-uri';
import type { TypeScript } from 'vue-component-meta';

type Node = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).Node;
type SourceFile = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).SourceFile;
type TypeNode = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).TypeNode;
type Checker = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Checker;
type Program = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Program;
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

	for (const binding of codegen?.getSetupBindings() ?? []) {
		if (testNames.has(binding)) {
			const node = searchDefaultImportIdentifier(ts, sourceFile, binding);
			if (node) {
				return {
					node,
					type: await checker.getTypeAtLocation(node),
				};
			}
		}
	}

	const selfName = getSelfComponentName(virtualCode.fileName);
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

/**
 * The component names available in a Vue file's template: the registered components, the file itself, and the
 * setup bindings whose type is a component.
 */
export async function getComponentNames(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	virtualCode: VueVirtualCode,
) {
	const components = findVariable(ts, sourceFile, names.components);
	if (!components) {
		return;
	}
	const componentNames = (await (await checker.getTypeAtLocation(components)).getProperties())
		.map(symbol => symbol.name)
		.filter(name => !name.includes('$') && !name.startsWith('_'));
	componentNames.push(getSelfComponentName(virtualCode.fileName));

	for (const binding of tsCodegen.get(virtualCode.ir)?.getSetupBindings() ?? []) {
		const symbol = await checker.resolveName(binding, ts.SymbolFlags.Value, components);
		if (symbol && await isComponentType(await getTypeOfSymbol(ts, checker, symbol, components))) {
			componentNames.push(binding);
		}
	}

	return [...new Set(componentNames)];
}

/**
 * The components that the modules of a program, other than external libraries, export. A default export is named
 * after its file in PascalCase, as a Vue file refers to itself.
 */
export async function getAutoImportComponents(
	ts: TypeScript,
	program: Program,
	checker: Checker,
): Promise<AutoImportComponent[]> {
	const modules = await getProjectModules(program, checker);
	const components = await Promise.all(
		modules.map(async ({ fileName, moduleSymbol }): Promise<AutoImportComponent[]> => {
			const exports = await checker.getExportsOfModule(moduleSymbol);
			const types = await checker.getTypeOfSymbol(
				await Promise.all(
					exports.map(async symbol =>
						symbol.flags & ts.SymbolFlags.Alias ? await checker.getAliasedSymbol(symbol) : symbol
					),
				),
			);
			const isComponent = await Promise.all(types.map(isComponentType));
			return exports
				.filter((_, j) => isComponent[j])
				.map(({ name: exportName }) => ({
					name: exportName === 'default'
						? getSelfComponentName(fileName)
						: exportName,
					fileName,
					exportName,
					description: path.posix.relative(program.getCurrentDirectory(), fileName),
				}));
		}),
	);
	return components.flat();
}

/** The named value exports called `name` of the modules of a program, other than external libraries. */
export async function getNamedValueExports(ts: TypeScript, program: Program, checker: Checker, name: string) {
	const modules = await getProjectModules(program, checker);
	const exports = await Promise.all(modules.map(async ({ fileName, moduleSymbol }) => {
		let symbol = await checker.getMemberInModuleExports(moduleSymbol, name);
		const target = symbol && symbol.flags & ts.SymbolFlags.Alias ? await checker.getAliasedSymbol(symbol) : symbol;
		if (!target || !(target.flags & ts.SymbolFlags.Value)) {
			symbol = undefined;
		}
		return symbol && { fileName, symbol };
	}));
	return exports.filter(entry => !!entry);
}

/** The modules of a program, other than external libraries, sorted by file name. */
async function getProjectModules(program: Program, checker: Checker) {
	// The program's order depends on which files are open.
	const allFileNames = [...await program.getSourceFileNames()].sort();
	const metadata = await Promise.all(allFileNames.map(fileName => program.getSourceFileMetadata(fileName)));
	const fileNames = allFileNames.filter((_, i) =>
		metadata[i] && !metadata[i].isFromExternalLibrary && !metadata[i].isDefaultLibrary
	);
	const moduleSymbols = await checker.getSymbolOfSourceFile(fileNames);
	return fileNames.flatMap((fileName, i) => {
		const moduleSymbol = moduleSymbols[i];
		return moduleSymbol ? [{ fileName, moduleSymbol }] : [];
	});
}

/**
 * The name of the identifier at `offset`, an offset in the generated service script, when it resolves to no symbol.
 */
export async function getUnresolvedName(ts: TypeScript, checker: Checker, sourceFile: SourceFile, offset: number) {
	const identifier = findIdentifier(ts, sourceFile, offset);
	if (identifier && ts.isIdentifier(identifier) && !await checker.getSymbolAtLocation(identifier)) {
		return identifier.text;
	}
}

/**
 * A constructor (`DefineComponent`, an SFC's default export, a class component) or a component options object.
 * Plain functions are not counted, as their type cannot tell a functional component from any other function.
 */
async function isComponentType(type: Type) {
	if ((await type.getConstructSignatures()).length) {
		return true;
	}
	if (type.isObjectType()) {
		for (const name of ['setup', 'render', 'template']) {
			if (await type.getProperty(name)) {
				return true;
			}
		}
	}
	return false;
}

/**
 * The offset in the generated service script of the props object literal of the component element that the
 * template offset `position` lies in (or after the start of).
 */
export function getComponentPropsOffset(
	language: Language<URI>,
	sourceScript: SourceScript<URI>,
	virtualCode: VueVirtualCode,
	position: number,
) {
	const { template } = virtualCode.ir;
	if (!template?.ast) {
		return;
	}
	const node = [...forEachElementNode(template.ast)].filter(child => position >= child.loc.start.offset).pop();
	// ElementTypes.COMPONENT
	if (node?.tagType !== 1) {
		return;
	}
	return toServiceScriptOffset(
		language,
		sourceScript,
		virtualCode,
		template.startTagEnd + node.loc.start.offset,
		data => !!data.__propsCompletion,
	);
}

/** Maps an offset of a Vue file's source text to its generated service script, through a mapping `filter` accepts. */
export function toServiceScriptOffset(
	language: Language<URI>,
	sourceScript: SourceScript<URI>,
	virtualCode: VueVirtualCode,
	sourceOffset: number,
	filter: (data: VueCodeInformation) => boolean,
) {
	const serviceScript = sourceScript.generated?.languagePlugin.typescript?.getServiceScript(virtualCode);
	if (!serviceScript) {
		return;
	}
	for (
		const [offset, mapping] of language.maps.get(serviceScript.code, sourceScript).toGeneratedLocation(sourceOffset)
	) {
		if (filter(mapping.data)) {
			return offset;
		}
	}
}

/**
 * Maps an offset of a Vue file's generated service script to its source text, through a mapping `filter` accepts.
 */
export function toSourceOffset(
	language: Language<URI>,
	sourceScript: SourceScript<URI>,
	virtualCode: VueVirtualCode,
	offset: number,
	filter: (data: VueCodeInformation) => boolean,
) {
	const serviceScript = sourceScript.generated?.languagePlugin.typescript?.getServiceScript(virtualCode);
	if (!serviceScript) {
		return;
	}
	for (const [sourceOffset, mapping] of language.maps.get(serviceScript.code, sourceScript).toSourceLocation(offset)) {
		if (filter(mapping.data)) {
			return sourceOffset;
		}
	}
}

/**
 * The template context properties (`__VLS_ctx.foo`) whose generated end offset `isExtracted` accepts, with their
 * types and whether they are written to.
 */
export async function collectExtractProps(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	isExtracted: (offset: number) => boolean,
) {
	const accesses: { name: string; node: Node; model: boolean }[] = [];
	visit(sourceFile);
	const result = new Map<string, ExtractPropsInfo>();
	for (const { name, node, model } of accesses) {
		let info = result.get(name);
		if (!info) {
			const typeString = await checker.typeToString(
				await checker.getTypeAtLocation(node),
				node,
				ts.TypeFormatFlags.NoTruncation,
			);
			info = { name, type: typeString.includes('__VLS_') ? 'any' : typeString, model: false };
			result.set(name, info);
		}
		info.model ||= model;
	}
	return [...result.values()];

	function visit(node: Node) {
		if (
			ts.isPropertyAccessExpression(node)
			&& ts.isIdentifier(node.expression)
			&& node.expression.text === names.ctx
			&& ts.isIdentifier(node.name)
			&& isExtracted(node.name.end)
		) {
			accesses.push({
				name: node.name.text,
				node,
				model: ts.isPostfixUnaryExpression(node.parent) || ts.isBinaryExpression(node.parent),
			});
		}
		node.forEachChild(visit);
	}
}

/** Whether the identifier at `offset`, an offset in the generated service script, is a `Ref`. */
export async function isRefAtOffset(ts: TypeScript, checker: Checker, sourceFile: SourceFile, offset: number) {
	const identifier = findIdentifier(ts, sourceFile, offset);
	if (!identifier) {
		return false;
	}
	for (const prop of await (await checker.getTypeAtLocation(identifier)).getProperties()) {
		for (const declaration of prop.declarations) {
			const node = await declaration.resolve();
			if (
				node
				&& ts.isPropertySignatureDeclaration(node)
				&& ts.isComputedPropertyName(node.name)
				&& ts.isIdentifier(node.name.expression)
				&& node.name.expression.text === 'RefSymbol'
			) {
				return true;
			}
		}
	}
	return false;
}

/**
 * The props of the component whose generated props object literal contains `offset`, an offset in the generated
 * service script.
 */
export async function getComponentProps(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	offset: number,
): Promise<ComponentPropInfo[] | undefined> {
	let objectLiteral: Node | undefined;
	visit(sourceFile);
	const type = objectLiteral && ts.isObjectLiteralExpression(objectLiteral)
		&& await checker.getContextualType(objectLiteral);
	if (!type) {
		return;
	}
	const props: ComponentPropInfo[] = [];
	for (const prop of await checker.getPropertiesOfType(type)) {
		const [documentation, tags, propType] = await Promise.all([
			checker.getDocumentationCommentOfSymbol(prop),
			checker.getJsDocTagsOfSymbol(prop),
			checker.getTypeOfSymbol(prop),
		]);
		const info: ComponentPropInfo = {
			name: prop.name,
			description: [
				documentation,
				...tags.map(tag => `*@${tag.name}*${tag.text ? ` — ${tag.text}` : ''}`),
			].filter(Boolean).join('\n\n'),
		};
		if (prop.flags & ts.SymbolFlags.Optional) {
			info.optional = true;
		}
		if (!booleanExceptionProps.has(prop.name) && await hasBooleanType(ts, propType)) {
			info.boolean = true;
		}
		props.push(info);
	}
	return props;

	function visit(node: Node) {
		if (node.pos <= offset && offset <= node.end) {
			if (ts.isObjectLiteralExpression(node)) {
				objectLiteral = node;
			}
			node.forEachChild(visit);
		}
	}
}

/** The names of the slots a Vue file declares. */
export async function getComponentSlots(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	virtualCode: VueVirtualCode,
) {
	const codegen = tsCodegen.get(virtualCode.ir);
	const slots = codegen
		&& findVariable(ts, sourceFile, codegen.getScriptSetupRanges()?.defineSlots?.name ?? names.slots);
	return slots && (await (await checker.getTypeAtLocation(slots)).getProperties()).map(symbol => symbol.name);
}

/** The attributes of the intrinsic element `tag` in a Vue file's template. */
export async function getElementAttrs(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	tag: string,
): Promise<ComponentPropInfo[] | undefined> {
	const intrinsics = findVariable(ts, sourceFile, names.intrinsics);
	const element = intrinsics && await (await checker.getTypeAtLocation(intrinsics)).getProperty(tag);
	if (!element) {
		return;
	}
	const attrs: ComponentPropInfo[] = [];
	for (const prop of await (await checker.getTypeOfSymbol(element)).getProperties()) {
		const info: ComponentPropInfo = { name: prop.name };
		if (!booleanExceptionProps.has(prop.name) && await hasBooleanType(ts, await checker.getTypeOfSymbol(prop))) {
			info.boolean = true;
		}
		attrs.push(info);
	}
	return attrs;
}

const booleanExceptionProps = new Set(['class', 'style']);

async function hasBooleanType(ts: TypeScript, type: Type): Promise<boolean> {
	if (type.flags & ts.TypeFlags.BooleanLike) {
		return true;
	}
	if (type.isUnionType() || type.isIntersectionType()) {
		for (const member of await type.getTypes()) {
			if (await hasBooleanType(ts, member)) {
				return true;
			}
		}
	}
	return false;
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

function findIdentifier(ts: TypeScript, sourceFile: SourceFile, offset: number) {
	return findNode(
		sourceFile,
		node => ts.isIdentifier(node) && node.getStart(sourceFile) <= offset && offset <= node.end,
		node => node.pos <= offset && offset <= node.end,
	);
}

function searchDefaultImportIdentifier(ts: TypeScript, sourceFile: SourceFile, name: string) {
	const node = findNode(sourceFile, node => ts.isImportDeclaration(node) && node.importClause?.name?.text === name);
	return node && ts.isImportDeclaration(node) ? node.importClause?.name : undefined;
}

/** The first node in pre-order that matches `predicate`, descending only into the nodes `descend` accepts. */
function findNode(
	node: Node,
	predicate: (node: Node) => boolean,
	descend: (node: Node) => boolean = () => true,
): Node | undefined {
	return predicate(node)
		? node
		: descend(node)
		? node.forEachChild(child => findNode(child, predicate, descend))
		: undefined;
}
