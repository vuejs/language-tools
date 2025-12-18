import * as core from '@vue/language-core';
import type * as ts from 'typescript';
import {
	inferComponentEmit,
	inferComponentExposed,
	inferComponentProps,
	inferComponentSlots,
	inferComponentType,
} from './helpers';
import { createSchemaResolvers } from './schemaResolvers';
import { getDefaultsFromScriptSetup } from './scriptSetup';
import type { ComponentMeta, MetaCheckerSchemaOptions, PropertyMeta } from './types';

export function getComponentMeta(
	ts: typeof import('typescript'),
	typeChecker: ts.TypeChecker,
	printer: ts.Printer,
	language: core.Language<string>,
	componentNode: ts.Node,
	componentType: ts.Type,
	options: MetaCheckerSchemaOptions,
	deprecatedOptions: { noDeclarations: boolean; rawType: boolean } = { noDeclarations: true, rawType: false },
): ComponentMeta {
	const componentSymbol = typeChecker.getSymbolAtLocation(componentNode);

	let componentFile = componentNode.getSourceFile();

	if (componentSymbol) {
		const symbol = componentSymbol.flags & ts.SymbolFlags.Alias
			? typeChecker.getAliasedSymbol(componentSymbol)
			: componentType.symbol;
		const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];

		if (declaration) {
			componentFile = declaration.getSourceFile();
			componentNode = declaration;
		}
	}

	let name: string | undefined;
	let description: string | undefined;
	let type: ReturnType<typeof getType> | undefined;
	let props: ReturnType<typeof getProps> | undefined;
	let events: ReturnType<typeof getEvents> | undefined;
	let slots: ReturnType<typeof getSlots> | undefined;
	let exposed: ReturnType<typeof getExposed> | undefined;

	const meta = {
		get name() {
			return name ?? (name = getName());
		},
		get description() {
			return description ?? (description = getDescription());
		},
		get type() {
			return type ?? (type = getType());
		},
		get props() {
			return props ?? (props = getProps());
		},
		get events() {
			return events ?? (events = getEvents());
		},
		get slots() {
			return slots ?? (slots = getSlots());
		},
		get exposed() {
			return exposed ?? (exposed = getExposed());
		},
	};

	return meta;

	function getType() {
		return inferComponentType(componentType) ?? 0;
	}

	function getProps() {
		const propsType = inferComponentProps(typeChecker, componentType);
		if (!propsType) {
			return [];
		}
		let result: PropertyMeta[] = [];

		const properties = propsType.getProperties();
		const eventProps = new Set(
			meta.events.map(event => `on${event.name.charAt(0).toUpperCase()}${event.name.slice(1)}`),
		);

		result = properties
			.map(prop => {
				const {
					resolveNestedProperties,
				} = createSchemaResolvers(ts, typeChecker, printer, language, options, deprecatedOptions);

				return resolveNestedProperties(prop);
			})
			.filter((prop): prop is PropertyMeta => !!prop && !eventProps.has(prop.name));

		const defaults = getDefaultsFromScriptSetup(ts, printer, language, componentFile.fileName);

		for (const prop of result) {
			if (prop.name.match(/^onVnode[A-Z]/)) {
				prop.name = 'onVue:' + prop.name['onVnode'.length]?.toLowerCase() + prop.name.slice('onVnode'.length + 1);
			}
			prop.default ??= defaults?.get(prop.name);
		}

		return result;
	}

	function getEvents() {
		const emitType = inferComponentEmit(typeChecker, componentType);

		if (emitType) {
			const calls = emitType.getCallSignatures();

			return calls.map(call => {
				const {
					resolveEventSignature,
				} = createSchemaResolvers(ts, typeChecker, printer, language, options, deprecatedOptions);

				return resolveEventSignature(call);
			}).filter(event => event.name);
		}

		return [];
	}

	function getSlots() {
		const slotsType = inferComponentSlots(typeChecker, componentType);

		if (slotsType) {
			const properties = slotsType.getProperties();

			return properties.map(prop => {
				const {
					resolveSlotProperties,
				} = createSchemaResolvers(ts, typeChecker, printer, language, options, deprecatedOptions);

				return resolveSlotProperties(prop);
			});
		}

		return [];
	}

	function getExposed() {
		const exposedType = inferComponentExposed(typeChecker, componentType);

		if (exposedType) {
			const propsType = inferComponentProps(typeChecker, componentType);
			const propsProperties = propsType?.getProperties() ?? [];
			const properties = exposedType.getProperties().filter(prop =>
				// only exposed props will have at least one declaration and no valueDeclaration
				prop.declarations?.length
				&& !prop.valueDeclaration
				// Cross-check with props to avoid including props here
				&& (!propsProperties.length || !propsProperties.some(({ name }) => name === prop.name))
				// Exclude $slots
				&& prop.name !== '$slots'
			);

			return properties.map(prop => {
				const {
					resolveExposedProperties,
				} = createSchemaResolvers(ts, typeChecker, printer, language, options, deprecatedOptions);

				return resolveExposedProperties(prop);
			});
		}

		return [];
	}

	function getName() {
		let decl = componentNode;

		// const __VLS_export = ...
		const text = componentFile.text.slice(decl.pos, decl.end);
		if (text.includes(core.names._export)) {
			ts.forEachChild(componentFile, child2 => {
				if (ts.isVariableStatement(child2)) {
					for (const { name, initializer } of child2.declarationList.declarations) {
						if (name.getText() === core.names._export && initializer) {
							decl = initializer;
						}
					}
				}
			});
		}

		return core.parseOptionsFromExtression(ts, decl, componentFile)?.name?.node.text;
	}

	function getDescription() {
		// Try to get JSDoc comments from the node using TypeScript API
		const jsDocComments = ts.getJSDocCommentsAndTags(componentNode);
		for (const jsDoc of jsDocComments) {
			if (ts.isJSDoc(jsDoc) && jsDoc.comment) {
				// Handle both string and array of comment parts
				if (typeof jsDoc.comment === 'string') {
					return jsDoc.comment;
				}
				else if (Array.isArray(jsDoc.comment)) {
					return jsDoc.comment.map(part => (part as any).text || '').join('');
				}
			}
		}

		// Fallback to symbol documentation
		const symbol = typeChecker.getSymbolAtLocation(componentNode);
		if (symbol) {
			const description = ts.displayPartsToString(symbol.getDocumentationComment(typeChecker));
			return description || undefined;
		}
	}
}
