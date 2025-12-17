import type * as core from '@vue/language-core';
import type * as ts from 'typescript';
import { resolveDefaultOptionExpression } from './scriptSetup';
import type { Declaration, EventMeta, ExposeMeta, PropertyMeta, PropertyMetaSchema, SlotMeta } from './types';

const publicPropsInterfaces = new Set([
	'PublicProps',
	'VNodeProps',
	'AllowedComponentProps',
	'ComponentCustomProps',
]);

export function createSchemaResolvers(
	ts: typeof import('typescript'),
	typeChecker: ts.TypeChecker,
	printer: ts.Printer,
	language: core.Language<string>,
	options: import('./types').MetaCheckerSchemaOptions,
) {
	const visited = new Set<ts.Type>();

	function shouldIgnore(subtype: ts.Type) {
		const name = getFullyQualifiedName(subtype);
		if (name === 'any') {
			return true;
		}

		if (visited.has(subtype)) {
			return true;
		}

		if (typeof options === 'object') {
			for (const item of options.ignore ?? []) {
				if (typeof item === 'function') {
					const result = item(name, subtype, typeChecker);
					if (typeof result === 'boolean') {
						return result;
					}
				}
				else if (name === item) {
					return true;
				}
			}
		}

		return false;
	}

	function reducer(acc: any, cur: any) {
		acc[cur.name] = cur;
		return acc;
	}

	function getJsDocTags(target: ts.Symbol | ts.Signature) {
		return target.getJsDocTags(typeChecker).map(tag => ({
			name: tag.name,
			text: tag.text !== undefined ? ts.displayPartsToString(tag.text) : undefined,
		}));
	}

	function resolveNestedProperties(propSymbol: ts.Symbol): PropertyMeta {
		const subtype = typeChecker.getTypeOfSymbol(propSymbol);
		let schema: PropertyMetaSchema | undefined;
		let declarations: Declaration[] | undefined;
		let global = false;
		let _default: string | undefined;
		let required = !(propSymbol.flags & ts.SymbolFlags.Optional);

		for (const decl of propSymbol.declarations ?? []) {
			if (isPublicProp(decl)) {
				global = true;
			}
			if (ts.isPropertyAssignment(decl) && ts.isObjectLiteralExpression(decl.initializer)) {
				for (const option of decl.initializer.properties) {
					if (ts.isPropertyAssignment(option)) {
						const key = option.name.getText();
						if (key === 'default') {
							const defaultExp = resolveDefaultOptionExpression(ts, option.initializer);
							_default = printer.printNode(ts.EmitHint.Expression, defaultExp, decl.getSourceFile());
						}
						else if (key === 'required') {
							if (option.initializer.getText() === 'true') {
								required = true;
							}
						}
					}
				}
			}
		}

		return {
			name: propSymbol.getEscapedName().toString(),
			global,
			default: _default,
			description: ts.displayPartsToString(propSymbol.getDocumentationComment(typeChecker)),
			tags: getJsDocTags(propSymbol),
			required,
			type: getFullyQualifiedName(subtype),
			get schema() {
				return schema ??= resolveSchema(subtype);
			},
			getDeclarations() {
				return declarations ??= getDeclarations(propSymbol.declarations ?? []);
			},
			getTypeObject() {
				return subtype;
			},
		};
	}

	function isPublicProp(declaration: ts.Declaration): boolean {
		let parent = declaration.parent;
		while (parent) {
			if (ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent)) {
				if (publicPropsInterfaces.has(parent.name.text)) {
					return true;
				}
				return false;
			}
			parent = parent.parent;
		}
		return false;
	}

	function resolveSlotProperties(prop: ts.Symbol): SlotMeta {
		const propType = typeChecker.getNonNullableType(typeChecker.getTypeOfSymbol(prop));
		const signatures = propType.getCallSignatures();
		const paramType = signatures[0]?.parameters[0];
		const subtype = paramType
			? typeChecker.getTypeOfSymbol(paramType)
			: typeChecker.getAnyType();
		let schema: PropertyMetaSchema | undefined;
		let declarations: Declaration[] | undefined;

		return {
			name: prop.getName(),
			type: getFullyQualifiedName(subtype),
			description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
			tags: getJsDocTags(prop),
			get schema() {
				return schema ??= resolveSchema(subtype);
			},
			getDeclarations() {
				return declarations ??= getDeclarations(prop.declarations ?? []);
			},
			getTypeObject() {
				return subtype;
			},
		};
	}
	function resolveExposedProperties(expose: ts.Symbol): ExposeMeta {
		const subtype = typeChecker.getTypeOfSymbol(expose);
		let schema: PropertyMetaSchema | undefined;
		let declarations: Declaration[] | undefined;

		return {
			name: expose.getName(),
			type: getFullyQualifiedName(subtype),
			description: ts.displayPartsToString(expose.getDocumentationComment(typeChecker)),
			tags: getJsDocTags(expose),
			get schema() {
				return schema ??= resolveSchema(subtype);
			},
			getDeclarations() {
				return declarations ??= getDeclarations(expose.declarations ?? []);
			},
			getTypeObject() {
				return subtype;
			},
		};
	}
	function resolveEventSignature(call: ts.Signature): EventMeta {
		let schema: PropertyMetaSchema[] | undefined;
		let declarations: Declaration[] | undefined;
		let subtype: ts.Type | undefined;
		let symbol: ts.Symbol | undefined;
		let subtypeStr = '[]';
		let getSchema = () => [] as PropertyMetaSchema[];

		if (call.parameters.length >= 2) {
			symbol = call.parameters[1]!;
			subtype = typeChecker.getTypeOfSymbol(symbol);
			if ((call.parameters[1]!.valueDeclaration as any)?.dotDotDotToken) {
				subtypeStr = getFullyQualifiedName(subtype);
				getSchema = () => typeChecker.getTypeArguments(subtype! as ts.TypeReference).map(resolveSchema);
			}
			else {
				subtypeStr = '[';
				for (let i = 1; i < call.parameters.length; i++) {
					subtypeStr += getFullyQualifiedName(typeChecker.getTypeOfSymbol(call.parameters[i]!))
						+ ', ';
				}
				subtypeStr = subtypeStr.slice(0, -2) + ']';
				getSchema = () => {
					const result: PropertyMetaSchema[] = [];
					for (let i = 1; i < call.parameters.length; i++) {
						result.push(resolveSchema(typeChecker.getTypeOfSymbol(call.parameters[i]!)));
					}
					return result;
				};
			}
		}

		return {
			name: (typeChecker.getTypeOfSymbol(call.parameters[0]!) as ts.StringLiteralType).value,
			description: ts.displayPartsToString(call.getDocumentationComment(typeChecker)),
			tags: getJsDocTags(call),
			type: subtypeStr,
			signature: typeChecker.signatureToString(call),
			get schema() {
				return schema ??= getSchema();
			},
			getDeclarations() {
				return declarations ??= call.declaration ? getDeclarations([call.declaration]) : [];
			},
			getTypeObject() {
				return subtype;
			},
		};
	}
	function resolveCallbackSchema(signature: ts.Signature): PropertyMetaSchema {
		let schema: PropertyMetaSchema[] | undefined;

		return {
			kind: 'event',
			type: typeChecker.signatureToString(signature),
			get schema() {
				return schema ??= signature.parameters.length
					? typeChecker
						.getTypeArguments(
							typeChecker.getTypeOfSymbol(signature.parameters[0]!) as ts.TypeReference,
						)
						.map(resolveSchema)
					: undefined;
			},
		};
	}
	function resolveSchema(subtype: ts.Type): PropertyMetaSchema {
		const type = getFullyQualifiedName(subtype);

		if (shouldIgnore(subtype)) {
			return type;
		}

		visited.add(subtype);

		if (subtype.isUnion()) {
			let schema: PropertyMetaSchema[] | undefined;
			return {
				kind: 'enum',
				type,
				get schema() {
					return schema ??= subtype.types.map(resolveSchema);
				},
			};
		}
		else if (typeChecker.isArrayLikeType(subtype)) {
			let schema: PropertyMetaSchema[] | undefined;
			return {
				kind: 'array',
				type,
				get schema() {
					return schema ??= typeChecker.getTypeArguments(subtype as ts.TypeReference).map(resolveSchema);
				},
			};
		}
		else if (
			subtype.getCallSignatures().length === 0
			&& (subtype.isClassOrInterface() || subtype.isIntersection()
				|| (subtype as ts.ObjectType).objectFlags & ts.ObjectFlags.Anonymous)
		) {
			let schema: Record<string, PropertyMeta> | undefined;
			return {
				kind: 'object',
				type,
				get schema() {
					return schema ??= subtype.getProperties().map(resolveNestedProperties).reduce(reducer, {});
				},
			};
		}
		else if (subtype.getCallSignatures().length === 1) {
			return resolveCallbackSchema(subtype.getCallSignatures()[0]!);
		}

		return type;
	}
	function getFullyQualifiedName(type: ts.Type) {
		const str = typeChecker.typeToString(
			type,
			undefined,
			ts.TypeFormatFlags.UseFullyQualifiedType | ts.TypeFormatFlags.NoTruncation,
		);
		if (str.includes('import(')) {
			return str.replace(/import\(.*?\)\./g, '');
		}
		return str;
	}
	function getDeclarations(declaration: ts.Declaration[]) {
		return declaration.map(getDeclaration).filter(d => !!d);
	}
	function getDeclaration(declaration: ts.Declaration): Declaration | undefined {
		const fileName = declaration.getSourceFile().fileName;
		const sourceScript = language.scripts.get(fileName);
		if (sourceScript?.generated) {
			const script = sourceScript.generated.languagePlugin.typescript?.getServiceScript(sourceScript.generated.root);
			if (script) {
				for (const [sourceScript, map] of language.maps.forEach(script.code)) {
					for (const [start] of map.toSourceLocation(declaration.getStart())) {
						for (const [end] of map.toSourceLocation(declaration.getEnd())) {
							return {
								file: sourceScript.id,
								range: [start, end],
							};
						}
					}
				}
			}
			return;
		}
		return {
			file: declaration.getSourceFile().fileName,
			range: [declaration.getStart(), declaration.getEnd()],
		};
	}

	return {
		resolveNestedProperties,
		resolveSlotProperties,
		resolveEventSignature,
		resolveExposedProperties,
		resolveSchema,
	};
}
