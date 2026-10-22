import type { Node } from 'typescript-7/ast' with { 'resolution-mode': 'import' };
import type { Checker, NodeHandle, Printer, Signature, Symbol, Type } from 'typescript-7/async' with {
	'resolution-mode': 'import',
};
import { resolveDefaultOptionExpression } from './scriptSetup';
import type {
	Declaration,
	EventMeta,
	ExposeMeta,
	MetaCheckerSchemaOptions,
	PropertyMeta,
	PropertyMetaSchema,
	SlotMeta,
} from './types';
import type { TypeScript } from './typescript';

const publicPropsInterfaces = new Set([
	'PublicProps',
	'VNodeProps',
	'AllowedComponentProps',
	'ComponentCustomProps',
]);

export interface SchemaResolverContext {
	ts: TypeScript;
	checker: Checker;
	printer: Printer | undefined;
	options: MetaCheckerSchemaOptions;
}

export function createSchemaResolvers({ ts, checker, printer, options }: SchemaResolverContext) {
	const visited = new Set<number>();

	async function shouldIgnore(name: string, subtype: Type) {
		if (name === 'any') {
			return true;
		}

		if (visited.has(subtype.id)) {
			return true;
		}

		if (options === false) {
			return true;
		}

		if (typeof options === 'object') {
			for (const item of options.ignore ?? []) {
				if (typeof item === 'function') {
					const result = await item(name, subtype, checker);
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

	async function resolveNestedProperties(propSymbol: Symbol, subtype: Type): Promise<PropertyMeta> {
		let global = false;
		let _default: string | undefined;
		let required = !(propSymbol.flags & ts.SymbolFlags.Optional);

		for (const decl of await resolveNodes(propSymbol.declarations)) {
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
						else if (key === 'required') {
							if (option.initializer.getText() === 'true') {
								required = true;
							}
						}
					}
				}
			}
		}

		const [type, docs, declarations] = await Promise.all([
			getFullyQualifiedName(subtype),
			getDocs(propSymbol),
			getDeclarations(propSymbol.declarations),
		]);

		return {
			name: propSymbol.escapedName,
			global,
			default: _default,
			...docs,
			required,
			type,
			schema: await resolveSchema(subtype, type),
			declarations,
		};
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

	async function resolveSlotProperties(prop: Symbol): Promise<SlotMeta> {
		const propType = await checker.getNonNullableType(await checker.getTypeOfSymbol(prop));
		const [signature] = await propType.getCallSignatures();
		const paramSymbol = signature ? (await signature.getParameters())[0] : undefined;
		const subtype = paramSymbol
			? await checker.getTypeOfSymbol(paramSymbol)
			: await checker.getAnyType();
		const [type, docs, declarations] = await Promise.all([
			getFullyQualifiedName(subtype),
			getDocs(prop),
			getDeclarations(prop.declarations),
		]);

		return {
			name: prop.name,
			type,
			...docs,
			schema: await resolveSchema(subtype, type),
			declarations,
		};
	}

	async function resolveExposedProperties(expose: Symbol): Promise<ExposeMeta> {
		const subtype = await checker.getTypeOfSymbol(expose);
		const [type, docs, declarations] = await Promise.all([
			getFullyQualifiedName(subtype),
			getDocs(expose),
			getDeclarations(expose.declarations),
		]);

		return {
			name: expose.name,
			type,
			...docs,
			schema: await resolveSchema(subtype, type),
			declarations,
		};
	}

	async function resolveEventSignature(call: Signature): Promise<EventMeta | undefined> {
		const [nameSymbol, ...argSymbols] = await call.getParameters();
		if (!nameSymbol) {
			return;
		}
		const nameType = await checker.getTypeOfSymbol(nameSymbol);
		if (!nameType.isStringLiteralType() || !nameType.value) {
			return;
		}

		let type = '[]';
		let schema: PropertyMetaSchema[] = [];

		if (argSymbols.length) {
			const argTypes = await checker.getTypeOfSymbol(argSymbols);
			if (argSymbols.length === 1 && call.hasRestParameter) {
				type = await getFullyQualifiedName(argTypes[0]!);
				schema = await resolveSchemas(await getTypeArguments(argTypes[0]!));
			}
			else {
				type = `[${(await Promise.all(argTypes.map(getFullyQualifiedName))).join(', ')}]`;
				schema = await resolveSchemas(argTypes);
			}
		}

		return {
			name: nameType.value,
			// TypeScript 7 does not expose the documentation of signatures
			description: '',
			tags: [],
			type,
			signature: await signatureToString(call),
			schema,
			declarations: await getDeclarations(call.declaration ? [call.declaration] : []),
		};
	}

	async function resolveCallbackSchema(signature: Signature): Promise<PropertyMetaSchema> {
		const [param] = await signature.getParameters();
		return {
			kind: 'event',
			type: await signatureToString(signature),
			schema: param
				? await resolveSchemas(await getTypeArguments(await checker.getTypeOfSymbol(param)))
				: undefined,
		};
	}

	async function resolveSchemas(types: readonly Type[]) {
		const result: PropertyMetaSchema[] = [];
		for (const type of types) {
			result.push(await resolveSchema(type));
		}
		return result;
	}

	async function resolveSchema(subtype: Type, type?: string): Promise<PropertyMetaSchema> {
		type ??= await getFullyQualifiedName(subtype);

		if (await shouldIgnore(type, subtype)) {
			return type;
		}

		visited.add(subtype.id);

		if (subtype.isUnionType()) {
			return {
				kind: 'enum',
				type,
				schema: await resolveSchemas(await subtype.getTypes() ?? []),
			};
		}
		else if (await checker.isArrayLikeType(subtype)) {
			return {
				kind: 'array',
				type,
				schema: await resolveSchemas(await getTypeArguments(subtype)),
			};
		}

		const callSignatures = await subtype.getCallSignatures();

		if (
			callSignatures.length === 0
			&& (subtype.isClassOrInterface() || subtype.isIntersectionType()
				|| (subtype.isObjectType() && subtype.objectFlags & ts.ObjectFlags.Anonymous))
		) {
			const properties = await subtype.getProperties();
			const types = properties.length ? await checker.getTypeOfSymbol(properties) : [];
			const schema: Record<string, PropertyMeta> = {};
			for (let i = 0; i < properties.length; i++) {
				const prop = await resolveNestedProperties(properties[i]!, types[i]!);
				schema[prop.name] = prop;
			}
			return {
				kind: 'object',
				type,
				schema,
			};
		}
		else if (callSignatures.length === 1) {
			return await resolveCallbackSchema(callSignatures[0]!);
		}
		else if (subtype.flags & ts.TypeFlags.EnumLiteral && subtype.isLiteralType()) {
			// enum members stringify to their qualified name (e.g. "MyEnum.Small"), which
			// hides the runtime value from consumers such as docs generators; expose the
			// value alongside, printed like any other literal
			const { value } = subtype;
			if (typeof value === 'string' || typeof value === 'number') {
				return {
					kind: 'literal',
					type,
					value: JSON.stringify(value),
				};
			}
		}

		return type;
	}

	async function getTypeArguments(type: Type) {
		return type.isTypeReference() ? await checker.getTypeArguments(type) : [];
	}

	async function signatureToString(signature: Signature) {
		if (!printer) {
			return '';
		}
		const node = await checker.signatureToSignatureDeclaration(signature, ts.SyntaxKind.CallSignature);
		return node ? await printer.printNode(node, { neverAsciiEscape: true }) : '';
	}

	async function getFullyQualifiedName(type: Type) {
		const str = await checker.typeToString(
			type,
			undefined,
			ts.TypeFormatFlags.UseFullyQualifiedType | ts.TypeFormatFlags.NoTruncation,
		);
		if (str.includes('import(')) {
			return str.replace(/import\(.*?\)\./g, '');
		}
		return str;
	}

	async function getDeclarations(handles: readonly NodeHandle[]) {
		const result: Declaration[] = [];
		for (const node of await resolveNodes(handles)) {
			const declaration = getDeclaration(node);
			if (declaration) {
				result.push(declaration);
			}
		}
		return result;
	}

	function getDeclaration(node: Node): Declaration | undefined {
		const sourceFile = node.getSourceFile();
		const start = node.getStart(sourceFile);
		if (sourceFile.spanMap) {
			const { range, fidelity } = sourceFile.spanMap.virtualToOriginalSpan({ pos: start, end: node.end });
			if (ts.SpanMap.isNone(fidelity)) {
				return;
			}
			return {
				file: sourceFile.fileName,
				start: range.pos,
				end: range.end,
			};
		}
		return {
			file: sourceFile.fileName,
			start,
			end: node.end,
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

async function resolveNodes(handles: readonly NodeHandle[]) {
	const nodes = await Promise.all(handles.map(handle => handle.resolve()));
	return nodes.filter(node => !!node);
}
