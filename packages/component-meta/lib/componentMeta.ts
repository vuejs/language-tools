import { names } from '@vue/language-core';
import type { Node, SourceFile } from 'typescript-7/ast' with { 'resolution-mode': 'import' };
import type { Project, Type } from 'typescript-7/async' with { 'resolution-mode': 'import' };
import {
	inferComponentEmit,
	inferComponentExposed,
	inferComponentProps,
	inferComponentSlots,
	inferComponentType,
} from './helpers';
import { createSchemaResolvers, type SchemaResolverContext } from './schemaResolvers';
import { getDefaultsFromScriptSetup } from './scriptSetup';
import type { ComponentMeta, ComponentMetaContext, EventMeta, MetaCheckerOptions, PropertyMeta } from './types';

const vnodeEventRE = /^onVnode[A-Z]/;

/** The names of a file's exports. Throws if the file is not part of `project`. */
export async function getExportNames(project: Project, fileName: string): Promise<string[]> {
	return (await getExports(project, fileName)).map(e => e.name);
}

/** The metadata of a component exported from a file. Throws if the file or the export is not found in `project`. */
export async function getComponentMeta(
	context: ComponentMetaContext,
	project: Project,
	fileName: string,
	exportName = 'default',
	options: MetaCheckerOptions = {},
): Promise<ComponentMeta> {
	const symbol = (await getExports(project, fileName)).find(e => e.name === exportName);
	const declaration = await symbol?.valueDeclaration?.resolve();
	const componentNode = declaration && getComponentExpression(context, declaration);
	if (!componentNode) {
		throw new Error(`Export '${exportName}' not found in '${fileName}'.`);
	}
	const componentType = await project.checker.getTypeAtLocation(componentNode);
	return await getComponentMetaOfType(context, project, componentType, componentNode, options);
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

function getComponentExpression({ ts }: ComponentMetaContext, node: Node) {
	return ts.isExportAssignment(node)
		? node.expression
		: ts.isVariableDeclaration(node)
		? node.initializer
		: node;
}

/**
 * The metadata of a component of type `componentType`. `componentNode` is the component's declaration, or a node
 * referring to it, from which the name, description and script setup defaults are read.
 */
export async function getComponentMetaOfType(
	context: ComponentMetaContext,
	project: Project,
	componentType: Type,
	componentNode: Node | undefined,
	options: MetaCheckerOptions = {},
): Promise<ComponentMeta> {
	const { ts, printer } = context;
	const { checker } = project;
	const declaration = componentNode && await resolveDeclaration(componentNode);
	const schemaContext: SchemaResolverContext = {
		ts,
		checker,
		printer,
		options: options.schema ?? false,
	};

	const [type, events, slots, exposed, description] = await Promise.all([
		inferComponentType(componentType),
		getEvents(),
		getSlots(),
		getExposed(),
		getDescription(),
	]);

	return {
		name: getName(),
		description,
		type: type ?? 0,
		props: await getProps(events),
		events,
		slots,
		exposed,
	};

	async function getProps(events: EventMeta[]) {
		const propsType = await inferComponentProps(checker, componentType);
		if (!propsType) {
			return [];
		}

		const properties = await propsType.getProperties();
		const types = properties.length ? await checker.getTypeOfSymbol(properties) : [];
		const eventProps = new Set(
			events.map(event => `on${event.name.charAt(0).toUpperCase()}${event.name.slice(1)}`),
		);
		const props = await Promise.all(
			properties.map((prop, i) => createSchemaResolvers(schemaContext).resolveNestedProperties(prop, types[i]!)),
		);
		// script setup defaults belong to the component a Vue file exports, not to other components declared in it
		const defaults = declaration && isVueFileExport(declaration)
			? getDefaultsFromScriptSetup(ts, declaration.getSourceFile())
			: new Map<string, string>();
		const result: PropertyMeta[] = props.filter(prop => !eventProps.has(prop.name));

		for (const prop of result) {
			if (vnodeEventRE.test(prop.name)) {
				prop.name = 'onVue:' + prop.name['onVnode'.length]?.toLowerCase() + prop.name.slice('onVnode'.length + 1);
			}
			prop.default ??= defaults.get(prop.name);
		}

		return result;
	}

	async function getEvents() {
		const emitType = await inferComponentEmit(checker, componentType);
		if (!emitType) {
			return [];
		}
		const events = await Promise.all(
			(await emitType.getCallSignatures()).map(call =>
				createSchemaResolvers(schemaContext).resolveEventSignature(call)
			),
		);
		return events.filter(event => !!event);
	}

	async function getSlots() {
		const slotsType = await inferComponentSlots(checker, componentType);
		if (!slotsType) {
			return [];
		}
		return await Promise.all(
			(await slotsType.getProperties()).map(prop => createSchemaResolvers(schemaContext).resolveSlotProperties(prop)),
		);
	}

	async function getExposed() {
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
		return await Promise.all(
			properties.map(prop => createSchemaResolvers(schemaContext).resolveExposedProperties(prop)),
		);
	}

	async function resolveDeclaration(node: Node) {
		const componentSymbol = await checker.getSymbolAtLocation(node);
		if (componentSymbol) {
			const symbol = componentSymbol.flags & ts.SymbolFlags.Alias
				? await checker.getAliasedSymbol(componentSymbol)
				: await componentType.getSymbol();
			node = await (symbol?.valueDeclaration ?? symbol?.declarations[0])?.resolve() ?? node;
		}
		return getComponentExpression(context, node);
	}

	function isVueFileExport(node: Node) {
		return node.getSourceFile().text.slice(node.pos, node.end).includes(names.export);
	}

	function getName() {
		if (!declaration) {
			return;
		}
		const componentFile = declaration.getSourceFile();
		let decl = declaration;

		// const __VLS_export = ...
		if (isVueFileExport(decl)) {
			for (const statement of componentFile.statements) {
				if (ts.isVariableStatement(statement)) {
					for (const { name, initializer } of statement.declarationList.declarations) {
						if (name.getText() === names.export && initializer) {
							decl = initializer;
						}
					}
				}
			}
		}

		return getNameOption(decl, componentFile);
	}

	async function getDescription() {
		if (!declaration) {
			return;
		}
		for (const jsDoc of ts.getJSDocCommentsAndTags(declaration)) {
			if (ts.isJSDoc(jsDoc) && jsDoc.comment) {
				return ts.getTextOfJSDocComment(jsDoc.comment);
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
