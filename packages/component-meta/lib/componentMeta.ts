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
import type { ComponentMeta, MetaCheckerOptions, PropertyMeta } from './types';

const vnodeEventRegex = /^onVnode[A-Z]/;

export function getComponentMeta(
	ts: typeof import('typescript'),
	program: ts.Program,
	printer: ts.Printer,
	vueOptions: core.VueCompilerOptions,
	language: core.Language<string>,
	sourceFile: ts.SourceFile,
	componentNode: ts.Expression,
	checkerOptions: MetaCheckerOptions,
): ComponentMeta {
	const typeChecker = program.getTypeChecker();

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
		return inferComponentType(typeChecker, componentNode) ?? 0;
	}

	function getProps() {
		const propsType = inferComponentProps(typeChecker, componentNode);
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
				} = createSchemaResolvers(ts, typeChecker, printer, language, componentNode, checkerOptions);

				return resolveNestedProperties(prop);
			})
			.filter(prop => !vnodeEventRegex.test(prop.name) && !eventProps.has(prop.name));

		// Merge default props from script setup
		const defaults = getDefaultsFromScriptSetup(ts, printer, language, sourceFile.fileName, vueOptions);

		if (defaults?.size) {
			for (const prop of result) {
				if (defaults.has(prop.name)) {
					prop.default = defaults.get(prop.name);
				}
			}
		}

		return result;
	}

	function getEvents() {
		const emitType = inferComponentEmit(typeChecker, componentNode);

		if (emitType) {
			const calls = emitType.getCallSignatures();

			return calls.map(call => {
				const {
					resolveEventSignature,
				} = createSchemaResolvers(ts, typeChecker, printer, language, componentNode, checkerOptions);

				return resolveEventSignature(call);
			}).filter(event => event.name);
		}

		return [];
	}

	function getSlots() {
		const slotsType = inferComponentSlots(typeChecker, componentNode);

		if (slotsType) {
			const properties = slotsType.getProperties();

			return properties.map(prop => {
				const {
					resolveSlotProperties,
				} = createSchemaResolvers(ts, typeChecker, printer, language, componentNode, checkerOptions);

				return resolveSlotProperties(prop);
			});
		}

		return [];
	}

	function getExposed() {
		const exposedType = inferComponentExposed(typeChecker, componentNode);

		if (exposedType) {
			const propsType = inferComponentProps(typeChecker, componentNode);
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
				} = createSchemaResolvers(ts, typeChecker, printer, language, componentNode, checkerOptions);

				return resolveExposedProperties(prop);
			});
		}

		return [];
	}

	function getName() {
		let decl = componentNode;

		// const __VLS_export = ...
		const text = sourceFile.text.slice(decl.pos, decl.end);
		if (text.includes(core.names._export)) {
			ts.forEachChild(sourceFile, child2 => {
				if (ts.isVariableStatement(child2)) {
					for (const { name, initializer } of child2.declarationList.declarations) {
						if (name.getText() === core.names._export && initializer) {
							decl = initializer;
						}
					}
				}
			});
		}

		return core.parseOptionsFromExtression(ts, decl, sourceFile)?.name?.node.text;
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
