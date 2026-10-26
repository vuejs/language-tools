import {
	forEachElementNode,
	getElementTagOffsets,
	getSelfComponentName,
	getStartEnd,
	type IRTemplate,
	type TextRange,
} from '@vue/language-core';
import type { VueVirtualCode } from '@vue/language-service';
import type { AutoImportExport, ComponentPropInfo, ExtractPropsInfo } from '@vue/language-service/lib/requests';
import { capitalize } from '@vue/shared';
import * as path from 'node:path';
import type { TypeScript } from 'vue-component-meta';
import { inferComponentProps } from 'vue-component-meta/lib/helpers';

type ElementNode = Parameters<typeof getElementTagOffsets>[0];
type Node = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).Node;
type SourceFile = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).SourceFile;
type SpanMapFeature = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).SpanMapFeature;
type TypeNode = import('typescript-7/ast', { with: { 'resolution-mode': 'import' }}).TypeNode;
type Checker = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Checker;
type Program = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Program;
type Symbol = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Symbol;
type Type = import('typescript-7/async', { with: { 'resolution-mode': 'import' }}).Type;

const directiveRE = /^v[A-Z]/;

/**
 * The positions of the text TypeScript checks for `sourceFile` that `offset`, an offset of the file's source text, maps
 * to through the segments taking part in `feature`; the text of a file without a content mapper is its source text.
 */
export function toCheckedPositions(sourceFile: SourceFile, offset: number, feature: SpanMapFeature) {
	return sourceFile.spanMap
		? sourceFile.spanMap.originalToVirtualPositions(offset, feature).map(({ position }) => position)
		: [offset];
}

/**
 * The type of the component or intrinsic element whose tag name, or its last segment for `<Foo.Bar>`, starts at
 * `offset` of a Vue file's source text, and its declaration when known.
 */
export async function getTagType(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	offset: number,
): Promise<{ node: Node | undefined; type: Type } | undefined> {
	const positions = toCheckedPositions(sourceFile, offset, ts.SpanMapFeature.Definition);
	for (const position of positions) {
		const node = getNodeAt(sourceFile, position, true);
		const symbol = await checker.getSymbolAtLocation(node);
		if (symbol) {
			return {
				node: await getDefaultImportName(ts, sourceFile, symbol) ?? await getComponentDeclaration(ts, checker, symbol),
				type: await getTypeOfSymbol(ts, checker, symbol, node),
			};
		}
	}

	// A Vue file refers to itself by its name, which declares no symbol.
	const moduleSymbol = positions.length ? await checker.getSymbolOfSourceFile(sourceFile.fileName) : undefined;
	const defaultExport = moduleSymbol && await checker.getMemberInModuleExports(moduleSymbol, 'default');
	if (!defaultExport) {
		return;
	}
	const type = await checker.getTypeOfSymbol(defaultExport);
	for (const position of positions) {
		if ((await checker.getTypeAtLocation(getNodeAt(sourceFile, position, false))).id === type.id) {
			return { node: await defaultExport.valueDeclaration?.resolve(), type };
		}
	}
}

/**
 * Whether the tag name starting at `offset` of a Vue file's source text resolves to nothing; undefined when the tag
 * maps to no code TypeScript checks.
 */
export async function isUnresolvedTag(ts: TypeScript, checker: Checker, sourceFile: SourceFile, offset: number) {
	if (toCheckedPositions(sourceFile, offset, ts.SpanMapFeature.Definition).length) {
		return !await getTagType(ts, checker, sourceFile, offset);
	}
}

/** The type of the expression that `length` characters from `offset` of a Vue file's source text map to. */
async function getExpressionType(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	offset: number,
	length: number,
) {
	const [position] = toCheckedPositions(sourceFile, offset, ts.SpanMapFeature.Definition);
	if (position === undefined) {
		return;
	}
	let node = getNodeAt(sourceFile, position, false);
	while (node.end < position + length && node.parent) {
		node = node.parent;
	}
	return await checker.getTypeAtLocation(node);
}

/** The name of the default import in `sourceFile` that `symbol` is. */
async function getDefaultImportName(ts: TypeScript, sourceFile: SourceFile, symbol: Symbol) {
	if (symbol.flags & ts.SymbolFlags.Alias) {
		const declaration = await symbol.declarations[0]?.resolve();
		if (declaration && ts.isImportClause(declaration) && declaration.getSourceFile().fileName === sourceFile.fileName) {
			return declaration.name;
		}
	}
}

/**
 * The module `specifier` as the code TypeScript checks for `fileName` resolves it, which is the module the template
 * of a Vue file is checked against; undefined when that code does not import it.
 */
export async function getModuleSymbol(
	ts: TypeScript,
	program: Program,
	checker: Checker,
	fileName: string,
	specifier: string,
) {
	for (const mode of [ts.ModuleKind.ESNext, ts.ModuleKind.CommonJS]) {
		const resolved = await program.getResolvedModule(fileName, specifier, mode);
		if (resolved) {
			return await checker.getSymbolOfSourceFile(resolved.resolvedFileName);
		}
	}
}

/** The properties of the interface or type alias that `moduleSymbol`, or the namespaces in `path`, export as `name`. */
async function getExportedTypeProperties(checker: Checker, moduleSymbol: Symbol, ...path: string[]) {
	let symbol: Symbol | undefined = moduleSymbol;
	for (const name of path) {
		symbol = symbol && await checker.getMemberInModuleExports(symbol, name);
	}
	return symbol && await (await checker.getDeclaredTypeOfSymbol(symbol)).getProperties();
}

/** The property names of the type of the script block expression at `range` of a Vue file, e.g. a component option. */
async function getOptionNames(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	block: { startTagEnd: number } | undefined,
	range: TextRange | undefined,
) {
	if (!block || !range) {
		return [];
	}
	const type = await getExpressionType(
		ts,
		checker,
		sourceFile,
		block.startTagEnd + range.start,
		range.end - range.start,
	);
	return type ? (await type.getProperties()).map(symbol => symbol.name) : [];
}

/**
 * The component names available in a Vue file's template: the local and registered components, the global
 * components of Vue, the file itself, and the setup bindings whose type is a component.
 */
export async function getComponentNames(
	ts: TypeScript,
	program: Program,
	checker: Checker,
	sourceFile: SourceFile,
	virtualCode: VueVirtualCode,
) {
	const { ir, scriptAnalysis } = virtualCode;
	const { lib, target } = scriptAnalysis.getResolvedOptions();
	const vue = await getModuleSymbol(ts, program, checker, sourceFile.fileName, lib);
	if (!vue) {
		return;
	}
	const componentNames = [
		...scriptAnalysis.getLocalComponents(),
		...await getOptionNames(
			ts,
			checker,
			sourceFile,
			ir.script,
			scriptAnalysis.getScriptRanges()?.exportDefault?.options?.components,
		),
		...(await getExportedTypeProperties(checker, vue, 'GlobalComponents') ?? []).map(symbol => symbol.name),
	];
	if (target < 3.5) {
		for (const name of ['Transition', 'TransitionGroup', 'KeepAlive', 'Suspense', 'Teleport']) {
			if (await checker.getMemberInModuleExports(vue, name)) {
				componentNames.push(name);
			}
		}
	}
	const filteredNames = componentNames.filter(name => !name.includes('$') && !name.startsWith('_'));
	filteredNames.push(getSelfComponentName(virtualCode.fileName));

	const location = getSetupScopeNode(ts, sourceFile, virtualCode);
	if (location) {
		for (const binding of scriptAnalysis.getSetupBindings()) {
			const symbol = await checker.resolveName(binding, ts.SymbolFlags.Value, location);
			if (symbol && await isComponentType(await getTypeOfSymbol(ts, checker, symbol, location))) {
				filteredNames.push(binding);
			}
		}
	}

	return [...new Set(filteredNames)];
}

/**
 * A node of the code TypeScript checks for a Vue file in the scope of its setup bindings: where the last mapped
 * statement of its script setup, or else its script, maps to.
 */
function getSetupScopeNode(ts: TypeScript, sourceFile: SourceFile, { ir }: VueVirtualCode) {
	for (const block of [ir.scriptSetup, ir.script]) {
		if (!block) {
			continue;
		}
		for (const statement of [...block.ast.statements].reverse()) {
			const offset = block.startTagEnd + getStartEnd(statement, block.ast).start;
			const [position] = toCheckedPositions(sourceFile, offset, ts.SpanMapFeature.Definition);
			if (position !== undefined) {
				return getNodeAt(sourceFile, position, false);
			}
		}
	}
}

export interface ProjectValueExport extends AutoImportExport {
	isComponent: boolean;
}

/**
 * The value exports of the modules of a program, other than external libraries. A default export is named after its
 * file in PascalCase, as a Vue file refers to itself.
 */
export async function getProjectValueExports(
	ts: TypeScript,
	program: Program,
	checker: Checker,
): Promise<ProjectValueExport[]> {
	const modules = await getProjectModules(program, checker);
	const valueExports = await Promise.all(
		modules.map(async ({ fileName, moduleSymbol }): Promise<ProjectValueExport[]> => {
			const exports = await checker.getExportsOfModule(moduleSymbol);
			const targets = await Promise.all(
				exports.map(async symbol =>
					symbol.flags & ts.SymbolFlags.Alias ? await checker.getAliasedSymbol(symbol) : symbol
				),
			);
			const types = await checker.getTypeOfSymbol(targets);
			const isComponent = await Promise.all(types.map(isComponentType));
			return exports.flatMap(({ name: exportName }, j): ProjectValueExport[] => {
				const { flags } = targets[j]!;
				if (!(flags & ts.SymbolFlags.Value)) {
					return [];
				}
				return [{
					name: exportName === 'default'
						? getSelfComponentName(fileName)
						: exportName,
					fileName,
					exportName,
					description: path.posix.relative(program.getCurrentDirectory(), fileName),
					kind: flags & ts.SymbolFlags.Class
						? 'class'
						: flags & ts.SymbolFlags.Function
						? 'function'
						: 'variable',
					isComponent: isComponent[j]!,
				}];
			});
		}),
	);
	return valueExports.flat();
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

/** The name of the identifier at `offset`, a position of the text TypeScript checks, when it resolves to no symbol. */
export async function getUnresolvedName(ts: TypeScript, checker: Checker, sourceFile: SourceFile, offset: number) {
	const identifier = findIdentifier(ts, sourceFile, offset);
	if (identifier && ts.isIdentifier(identifier) && !await checker.getSymbolAtLocation(identifier)) {
		return identifier.text;
	}
}

/**
 * The location of the declaration of the component whose tag name starts at `offset` of a Vue file's source text, in
 * the source text of the file declaring it, when that is another file.
 */
export async function getComponentDefinition(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	offset: number,
) {
	const node = (await getTagType(ts, checker, sourceFile, offset))?.node;
	const declarationFile = node?.getSourceFile();
	if (!node || !declarationFile || declarationFile.fileName === sourceFile.fileName) {
		return;
	}
	const name = (node as { name?: Node }).name;
	const target = name && ts.isIdentifier(name) ? name : node;
	let start = target.getStart(declarationFile);
	let end = target.end;
	let text = declarationFile.text;
	if (declarationFile.spanMap) {
		({ pos: start, end } = declarationFile.spanMap.virtualToOriginalSpan({ pos: start, end }).range);
		text = declarationFile.originalText;
	}
	return {
		fileName: declarationFile.fileName,
		range: { start: toLineAndCharacter(text, start), end: toLineAndCharacter(text, end) },
	};
}

function toLineAndCharacter(text: string, offset: number) {
	const lines = text.slice(0, offset).split('\n');
	return { line: lines.length - 1, character: lines.at(-1)!.length };
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

/** The element that the offset `position` of `template` lies in (or after the start of). */
export function getElementAt(template: IRTemplate | undefined, position: number) {
	return template?.ast
		&& [...forEachElementNode(template.ast)].filter(child => position >= child.loc.start.offset).pop();
}

/** The offset in a Vue file's source text of the tag name of `element`, or its last segment for `<Foo.Bar>`. */
export function getTagNameOffset(template: IRTemplate, element: ElementNode) {
	return template.startTagEnd + getElementTagOffsets(element, template)[0] + element.tag.lastIndexOf('.') + 1;
}

/**
 * The template context properties that the template references from offset `start` to `end` of a Vue file's
 * source text, with their types and whether they are written to.
 */
export async function collectExtractProps(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	{ ir, scriptAnalysis }: VueVirtualCode,
	start: number,
	end: number,
) {
	const result = new Map<string, ExtractPropsInfo>();
	if (!ir.template) {
		return [];
	}
	for (const { name, offset, model } of scriptAnalysis.getTemplateScope().contextAccesses) {
		const sourceOffset = ir.template.startTagEnd + offset;
		if (sourceOffset < start || sourceOffset >= end) {
			continue;
		}
		let info = result.get(name);
		if (!info) {
			const node = toCheckedPositions(sourceFile, sourceOffset, ts.SpanMapFeature.SemanticTokens)
				.map(position => getNodeAt(sourceFile, position, false))
				.find(node => ts.isIdentifier(node) && node.text === name);
			if (!node) {
				continue;
			}
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
}

/** Whether the identifier at `offset`, a position of the text TypeScript checks, is a `Ref`. */
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
 * The props of the component whose tag name starts at `offset` of a Vue file's source text or, given
 * `expressionLength`, of the component that the expression of that length at `offset` evaluates to.
 */
export async function getComponentProps(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	offset: number,
	expressionLength?: number,
): Promise<ComponentPropInfo[] | undefined> {
	const componentType = expressionLength === undefined
		? (await getTagType(ts, checker, sourceFile, offset))?.type
		: await getExpressionType(ts, checker, sourceFile, offset, expressionLength);
	const type = componentType && await inferComponentProps(checker, componentType);
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
}

/** The names of the slots a Vue file declares with `defineSlots`. */
export async function getComponentSlots(
	ts: TypeScript,
	checker: Checker,
	sourceFile: SourceFile,
	virtualCode: VueVirtualCode,
) {
	const { scriptSetup } = virtualCode.ir;
	const defineSlots = virtualCode.scriptAnalysis.getScriptSetupRanges()?.defineSlots;
	if (!scriptSetup || !defineSlots) {
		return;
	}
	for (
		const position of toCheckedPositions(
			sourceFile,
			scriptSetup.startTagEnd + defineSlots.exp.start,
			ts.SpanMapFeature.Definition,
		)
	) {
		const callee = getNodeAt(sourceFile, position, false);
		const call = callee.parent;
		if (call && ts.isCallExpression(call) && call.expression === callee) {
			return (await (await checker.getTypeAtLocation(call)).getProperties()).map(symbol => symbol.name);
		}
	}
}

/** The intrinsic elements of Vue (`JSX.IntrinsicElements` of `<lib>/jsx-runtime`) as a Vue file's template sees them. */
async function getIntrinsicElements(
	ts: TypeScript,
	program: Program,
	checker: Checker,
	sourceFile: SourceFile,
	virtualCode: VueVirtualCode,
) {
	const { lib } = virtualCode.scriptAnalysis.getResolvedOptions();
	const jsxRuntime = await getModuleSymbol(ts, program, checker, sourceFile.fileName, `${lib}/jsx-runtime`);
	return jsxRuntime && await getExportedTypeProperties(checker, jsxRuntime, 'JSX', 'IntrinsicElements');
}

/** The intrinsic element names available in a Vue file's template. */
export async function getElementNames(
	ts: TypeScript,
	program: Program,
	checker: Checker,
	sourceFile: SourceFile,
	virtualCode: VueVirtualCode,
) {
	return (await getIntrinsicElements(ts, program, checker, sourceFile, virtualCode))?.map(symbol => symbol.name);
}

/**
 * The directive names (`vFoo`) available in a Vue file's template: the local and registered directives and the
 * global directives of Vue.
 */
export async function getComponentDirectives(
	ts: TypeScript,
	program: Program,
	checker: Checker,
	sourceFile: SourceFile,
	virtualCode: VueVirtualCode,
) {
	const { ir, scriptAnalysis } = virtualCode;
	const vue = await getModuleSymbol(ts, program, checker, sourceFile.fileName, scriptAnalysis.getResolvedOptions().lib);
	if (!vue) {
		return;
	}
	const directiveOptions = await getOptionNames(
		ts,
		checker,
		sourceFile,
		ir.script,
		scriptAnalysis.getScriptRanges()?.exportDefault?.options?.directives,
	);
	return [
		...scriptAnalysis.getLocalDirectives(),
		...directiveOptions.map(name => `v${capitalize(name)}`),
		...(await getExportedTypeProperties(checker, vue, 'GlobalDirectives') ?? []).map(symbol => symbol.name),
	].filter(name => directiveRE.test(name));
}

/**
 * The attributes of the intrinsic element whose tag name starts at `offset` of a Vue file's source text, or else of
 * the intrinsic element `tag`.
 */
export async function getElementAttrs(
	ts: TypeScript,
	program: Program,
	checker: Checker,
	sourceFile: SourceFile,
	virtualCode: VueVirtualCode,
	offset: number | undefined,
	tag: string,
): Promise<ComponentPropInfo[] | undefined> {
	let type = offset === undefined ? undefined : (await getTagType(ts, checker, sourceFile, offset))?.type;
	if (!type) {
		// Tags TypeScript does not check as intrinsic elements (`<template>`, a custom element it checks as a component)
		// have no position to read, so they are looked up in the intrinsic elements of Vue by name.
		const element = (await getIntrinsicElements(ts, program, checker, sourceFile, virtualCode))
			?.find(symbol => symbol.name === tag);
		type = element && await checker.getTypeOfSymbol(element);
	}
	if (!type) {
		return;
	}
	const attrs: ComponentPropInfo[] = [];
	for (const prop of await type.getProperties()) {
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

function findIdentifier(ts: TypeScript, sourceFile: SourceFile, offset: number) {
	return findNode(
		sourceFile,
		node => ts.isIdentifier(node) && node.getStart(sourceFile) <= offset && offset <= node.end,
		node => node.pos <= offset && offset <= node.end,
	);
}

/** The innermost node whose range holds `position`, descending into JSDoc comments when `jsDoc` is set. */
function getNodeAt(node: Node, position: number, jsDoc: boolean): Node {
	const holds = (child: Node) => child.pos <= position && position < child.end ? child : undefined;
	const child = (jsDoc ? (node as { jsDoc?: Node[] }).jsDoc?.find(holds) : undefined) ?? node.forEachChild(holds);
	return child ? getNodeAt(child, position, jsDoc) : node;
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
