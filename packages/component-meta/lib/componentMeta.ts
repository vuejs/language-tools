import { names } from '@vue/language-core';
import type { Node, SourceFile } from 'typescript-7/ast' with { 'resolution-mode': 'import' };
import type { Project } from 'typescript-7/async' with { 'resolution-mode': 'import' };
import {
	inferComponentEmit,
	inferComponentExposed,
	inferComponentProps,
	inferComponentSlots,
	inferComponentType,
} from './helpers';
import { createSchemaResolvers, type SchemaResolverContext } from './schemaResolvers';
import { getDefaultsFromScriptSetup } from './scriptSetup';
import type { ComponentMeta, ComponentMetaOptions, EventMeta, PropertyMeta } from './types';
import { loadTypeScript, type TypeScript } from './typescript';

const vnodeEventRE = /^onVnode[A-Z]/;

/** The names of a file's exports. Throws if the file is not part of `project`. */
export async function getExportNames(project: Project, fileName: string): Promise<string[]> {
	return (await getExports(project, fileName)).map(e => e.name);
}

/** The metadata of a component exported from a file. Throws if the file or the export is not found in `project`. */
export async function getComponentMeta(
	project: Project,
	fileName: string,
	exportName = 'default',
	options: ComponentMetaOptions = {},
): Promise<ComponentMeta> {
	const ts = await loadTypeScript();
	const symbol = (await getExports(project, fileName)).find(e => e.name === exportName);
	const declaration = await symbol?.valueDeclaration?.resolve();
	const componentNode = declaration && (
		ts.isExportAssignment(declaration)
			? declaration.expression
			: ts.isVariableDeclaration(declaration)
			? declaration.initializer
			: undefined
	);
	if (!componentNode) {
		throw new Error(`Export '${exportName}' not found in '${fileName}'.`);
	}
	return await resolveComponentMeta(ts, project, componentNode, options);
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

async function resolveComponentMeta(
	ts: TypeScript,
	project: Project,
	componentNode: Node,
	options: ComponentMetaOptions,
): Promise<ComponentMeta> {
	const { checker } = project;
	const componentType = await checker.getTypeAtLocation(componentNode);
	const componentSymbol = await checker.getSymbolAtLocation(componentNode);
	if (componentSymbol) {
		const symbol = componentSymbol.flags & ts.SymbolFlags.Alias
			? await checker.getAliasedSymbol(componentSymbol)
			: await componentType.getSymbol();
		const declaration = await (symbol?.valueDeclaration ?? symbol?.declarations[0])?.resolve();
		if (declaration) {
			componentNode = declaration;
		}
	}
	const componentFile = componentNode.getSourceFile();
	const context: SchemaResolverContext = {
		ts,
		checker,
		printer: options.printer,
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
			properties.map((prop, i) => createSchemaResolvers(context).resolveNestedProperties(prop, types[i]!)),
		);
		const defaults = getDefaultsFromScriptSetup(ts, componentFile);
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
			(await emitType.getCallSignatures()).map(call => createSchemaResolvers(context).resolveEventSignature(call)),
		);
		return events.filter(event => !!event);
	}

	async function getSlots() {
		const slotsType = await inferComponentSlots(checker, componentType);
		if (!slotsType) {
			return [];
		}
		return await Promise.all(
			(await slotsType.getProperties()).map(prop => createSchemaResolvers(context).resolveSlotProperties(prop)),
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
			properties.map(prop => createSchemaResolvers(context).resolveExposedProperties(prop)),
		);
	}

	function getName() {
		let decl = componentNode;

		// const __VLS_export = ...
		if (componentFile.text.slice(decl.pos, decl.end).includes(names.export)) {
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
		for (const jsDoc of ts.getJSDocCommentsAndTags(componentNode)) {
			if (ts.isJSDoc(jsDoc) && jsDoc.comment) {
				return ts.getTextOfJSDocComment(jsDoc.comment);
			}
		}

		const symbol = await checker.getSymbolAtLocation(componentNode);
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
