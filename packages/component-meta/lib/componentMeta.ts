import type { TypeScript as CoreTypeScript } from '@vue/language-core';
import { loadTypeScript } from '@vue/language-core/lib/typescript';
import type { Node, SourceFile } from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { Project, Symbol, Type } from 'typescript/async' with { 'resolution-mode': 'import' };
import { inferComponentEmit, inferComponentExposed, inferComponentProps, inferComponentSlots } from './helpers';
import { getDefaultsFromScriptSetup, resolveDefaultOptionExpression } from './scriptSetup';
import type { ComponentMeta, EventMeta, ExposeMeta, PropMeta, SlotMeta, TypeScript } from './types';
import { createTypeTable, toDeclarations } from './typeTable';
import { getVueFile } from './vueFile';

const vnodeEventRE = /^onVnode[A-Z]/;
const publicPropsInterfaces = new Set([
	'PublicProps',
	'VNodeProps',
	'AllowedComponentProps',
	'ComponentCustomProps',
]);

/** The names of a file's exports. Throws if the file is not part of `project`. */
export async function getExportNames(project: Project, fileName: string): Promise<string[]> {
	return (await getExports(project, fileName)).map(e => e.name);
}

/**
 * The metadata of a component exported from a file. Throws if the file or the export is not found in `project`.
 * `parser` parses the script blocks of Vue files.
 */
export async function getComponentMeta(
	ts: TypeScript,
	project: Project,
	fileName: string,
	exportName = 'default',
	parser: CoreTypeScript = loadTypeScript(),
): Promise<ComponentMeta> {
	const symbol = (await getExports(project, fileName)).find(e => e.name === exportName);
	const declaration = await symbol?.valueDeclaration?.resolve();
	const componentNode = declaration && getComponentExpression(ts, declaration);
	if (!componentNode) {
		throw new Error(`Export '${exportName}' not found in '${fileName}'.`);
	}
	const componentType = await project.checker.getTypeAtLocation(componentNode);
	return await getComponentMetaOfType(ts, project, componentType, componentNode, parser);
}

async function getExports(project: Project, fileName: string) {
	const { checker, program } = project;
	fileName = fileName.replace(/\\/g, '/');
	if (!await program.getSourceFile(fileName)) {
		throw new Error(`'${fileName}' is not part of the project.`);
	}
	const moduleSymbol = await checker.getSymbolOfSourceFile(fileName);
	return moduleSymbol ? await checker.getExportsOfModule(moduleSymbol) : [];
}

function getComponentExpression(ts: TypeScript, node: Node) {
	return ts.isExportAssignment(node)
		? node.expression
		: ts.isVariableDeclaration(node)
		? node.initializer
		: node;
}

/**
 * The metadata of a component of type `componentType`. `componentNode` is the component's declaration, or a node
 * referring to it, from which the name, description and script setup defaults are read. `parser` parses the
 * script blocks of Vue files.
 */
export async function getComponentMetaOfType(
	ts: TypeScript,
	project: Project,
	componentType: Type,
	componentNode: Node | undefined,
	parser: CoreTypeScript = loadTypeScript(),
): Promise<ComponentMeta> {
	const { checker } = project;
	const table = createTypeTable(ts, project);
	const declaration = componentNode && await resolveDeclaration(componentNode);
	// the component a Vue file exports, not other components declared in it
	const vueFile = declaration && isVueFileExport(declaration)
		? getVueFile(parser, project, declaration.getSourceFile())
		: undefined;

	const [events, slots, exposed, description] = await Promise.all([
		getEvents(),
		getSlots(),
		getExposed(),
		getDescription(),
	]);
	const props = await getProps(events);
	await table.flush();

	const members = [...props, ...events, ...slots, ...exposed];
	const { types, map } = table.finish(members.map(member => member.type));
	for (const member of members) {
		member.type = map(member.type);
	}
	return {
		name: getName(),
		description,
		props,
		events,
		slots,
		exposed,
		types,
	};

	async function getProps(events: EventMeta[]): Promise<PropMeta[]> {
		const propsType = await inferComponentProps(checker, componentType);
		if (!propsType) {
			return [];
		}
		const eventProps = new Set(
			events.map(event => `on${event.name.charAt(0).toUpperCase()}${event.name.slice(1)}`),
		);
		const properties = (await propsType.getProperties()).filter(prop => !eventProps.has(prop.name));
		const types = properties.length ? await checker.getTypeOfSymbol(properties) : [];
		const defaults = vueFile ? getDefaultsFromScriptSetup(parser, vueFile) : new Map<string, string>();

		return await Promise.all(properties.map(async (prop, i): Promise<PropMeta> => {
			let name = prop.escapedName as string;
			if (vnodeEventRE.test(name)) {
				name = 'onVue:' + name['onVnode'.length]?.toLowerCase() + name.slice('onVnode'.length + 1);
			}
			const [nodes, docs] = await Promise.all([table.resolveNodes(prop.declarations), getDocs(prop)]);
			const options = getPropOptions(prop, nodes);
			return {
				name,
				required: options.required,
				default: options.default ?? defaults.get(name),
				...docs,
				global: options.global,
				declarations: toDeclarations(ts, nodes),
				type: table.ref(types[i]!),
			};
		}));
	}

	function getPropOptions(prop: Symbol, nodes: Node[]) {
		let global = false;
		let _default: string | undefined;
		let required = !(prop.flags & ts.SymbolFlags.Optional);
		for (const decl of nodes) {
			if (isPublicProp(decl)) {
				global = true;
			}
			if (ts.isPropertyAssignment(decl) && ts.isObjectLiteralExpression(decl.initializer)) {
				for (const option of decl.initializer.properties) {
					if (ts.isPropertyAssignment(option)) {
						const key = option.name.getText();
						if (key === 'default') {
							_default = resolveDefaultOptionExpression(ts, option.initializer).getText();
						}
						else if (key === 'required' && option.initializer.getText() === 'true') {
							required = true;
						}
					}
				}
			}
		}
		return { global, default: _default, required };
	}

	function isPublicProp(declaration: Node): boolean {
		let parent = declaration.parent;
		while (parent) {
			if (ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent)) {
				return publicPropsInterfaces.has(parent.name.text);
			}
			parent = parent.parent;
		}
		return false;
	}

	async function getEvents(): Promise<EventMeta[]> {
		const emitType = await inferComponentEmit(checker, componentType);
		if (!emitType) {
			return [];
		}
		const events = await Promise.all((await emitType.getCallSignatures()).map(async signature => {
			const [nameSymbol] = await signature.getParameters();
			const nameType = nameSymbol && await checker.getTypeOfSymbol(nameSymbol);
			if (!nameType?.isStringLiteralType() || !nameType.value) {
				return;
			}
			const [nodes, type] = await Promise.all([
				table.resolveNodes(signature.declaration ? [signature.declaration] : []),
				table.refSignature(signature, 1),
			]);
			return {
				name: nameType.value,
				// TypeScript 7 does not expose the documentation of signatures
				description: '',
				tags: [],
				declarations: toDeclarations(ts, nodes),
				type,
			};
		}));
		return events.filter(event => !!event);
	}

	async function getSlots(): Promise<SlotMeta[]> {
		const slotsType = await inferComponentSlots(checker, componentType);
		if (!slotsType) {
			return [];
		}
		return await Promise.all((await slotsType.getProperties()).map(async (prop): Promise<SlotMeta> => {
			const [slotPropsType, docs, nodes] = await Promise.all([
				getSlotPropsType(prop),
				getDocs(prop),
				table.resolveNodes(prop.declarations),
			]);
			return { name: prop.name, ...docs, declarations: toDeclarations(ts, nodes), type: table.ref(slotPropsType) };
		}));
	}

	async function getSlotPropsType(slot: Symbol) {
		const slotType = await checker.getNonNullableType(await checker.getTypeOfSymbol(slot));
		const [signature] = await slotType.getCallSignatures();
		const paramSymbol = signature ? (await signature.getParameters())[0] : undefined;
		return paramSymbol ? await checker.getTypeOfSymbol(paramSymbol) : await checker.getAnyType();
	}

	async function getExposed(): Promise<ExposeMeta[]> {
		const exposedType = await inferComponentExposed(checker, componentType);
		if (!exposedType) {
			return [];
		}
		const propsType = await inferComponentProps(checker, componentType);
		const propsProperties = await propsType?.getProperties() ?? [];
		const properties = (await exposedType.getProperties()).filter(prop =>
			// only exposed props will have at least one declaration and no valueDeclaration
			prop.declarations.length
			&& !prop.valueDeclaration
			// Cross-check with props to avoid including props here
			&& !propsProperties.some(({ name }) => name === prop.name)
			// Exclude $slots
			&& prop.name !== '$slots'
		);
		const types = properties.length ? await checker.getTypeOfSymbol(properties) : [];
		return await Promise.all(properties.map(async (prop, i): Promise<ExposeMeta> => {
			const [docs, nodes] = await Promise.all([getDocs(prop), table.resolveNodes(prop.declarations)]);
			return { name: prop.name, ...docs, declarations: toDeclarations(ts, nodes), type: table.ref(types[i]!) };
		}));
	}

	async function getDocs(symbol: Symbol) {
		const [description, tags] = await Promise.all([
			checker.getDocumentationCommentOfSymbol(symbol),
			checker.getJsDocTagsOfSymbol(symbol),
		]);
		return {
			description,
			tags: tags.map(tag => ({ name: tag.name, text: tag.text })),
		};
	}

	async function resolveDeclaration(node: Node) {
		const componentSymbol = await checker.getSymbolAtLocation(node);
		if (componentSymbol) {
			const symbol = componentSymbol.flags & ts.SymbolFlags.Alias
				? await checker.getAliasedSymbol(componentSymbol)
				: await componentType.getSymbol();
			node = await (symbol?.valueDeclaration ?? symbol?.declarations[0])?.resolve() ?? node;
		}
		return getComponentExpression(ts, node);
	}

	/** Whether `node` is what the default export of a file that a content mapper maps evaluates to. */
	function isVueFileExport(node: Node) {
		const sourceFile = node.getSourceFile();
		return !!sourceFile.contentMapper && sourceFile.statements.some(statement =>
			ts.isExportAssignment(statement)
			&& !statement.isExportEquals
			&& statement.expression.pos === node.pos
			&& statement.expression.end === node.end
		);
	}

	function getName() {
		if (!declaration) {
			return;
		}
		if (vueFile) {
			return vueFile.ir.scriptSetup
				? undefined
				: vueFile.scriptAnalysis.getScriptRanges()?.exportDefault?.options?.name?.node.text;
		}
		return getNameOption(declaration, declaration.getSourceFile());
	}

	async function getDescription() {
		if (!declaration) {
			return;
		}
		for (const jsDoc of ts.getJSDocCommentsAndTags(declaration)) {
			const text = ts.isJSDoc(jsDoc) && jsDoc.comment && ts.getTextOfJSDocComment(jsDoc.comment);
			if (text) {
				return text;
			}
		}

		const symbol = await checker.getSymbolAtLocation(declaration);
		if (symbol) {
			return await checker.getDocumentationCommentOfSymbol(symbol) || undefined;
		}
	}

	function getNameOption(exp: Node, sourceFile: SourceFile) {
		while (
			ts.isParenthesizedExpression(exp)
			|| ts.isAssertionExpression(exp)
			|| ts.isNonNullExpression(exp)
			|| ts.isSatisfiesExpression(exp)
		) {
			exp = exp.expression;
		}

		const obj = ts.isObjectLiteralExpression(exp)
			? exp
			: ts.isCallExpression(exp) && exp.arguments[0] && ts.isObjectLiteralExpression(exp.arguments[0])
			? exp.arguments[0]
			: undefined;

		let name: string | undefined;
		for (const prop of obj?.properties ?? []) {
			if (
				ts.isPropertyAssignment(prop)
				&& ts.isIdentifier(prop.name)
				&& prop.name.getText(sourceFile) === 'name'
				&& ts.isStringLiteral(prop.initializer)
			) {
				name = prop.initializer.text;
			}
		}
		return name;
	}
}
