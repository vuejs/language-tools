import * as vue from '@volar/vue-language-core';
import * as ts from 'typescript/lib/tsserverlibrary';

export type PropertyMeta = {
	name: string;
	description: string;
	required: boolean;
	type: string;
	tags: { name: string, text?: string; }[];
	schema: PropertyMetaSchema;
};

export type PropertyMetaSchema = string
	| { kind: 'enum', type: string, schema: PropertyMetaSchema[]; }
	| { kind: 'array', type: string, schema: PropertyMetaSchema[]; }
	| { kind: 'event', type: string, schema: PropertyMetaSchema[]; }
	| { kind: 'object', type: string, schema: Record<string, PropertyMeta>; };

/**
 * Helper array to map internal properties added by vue to any components
 * 
 * @example
 * ```ts
 * import { createComponentMetaChecker, ComponentInternalProperties } from 'vue-component-meta'
 * 
 * const checker = createComponentMetaChecker('path/to/tsconfig.json')
 * const meta = checker.getComponentMeta('path/to/component.vue')
 * const props = meta.props.filter(prop => !ComponentInternalProperties.includes(prop.name))
 * ```
 */
export const ComponentInternalProperties = [
	'ref',
	'key',
	'ref_for',
	'ref_key',
	'onVnodeBeforeMount',
	'onVnodeMounted',
	'onVnodeBeforeUpdate',
	'onVnodeBeforeUnmount',
	'onVnodeUpdated',
	'onVnodeUnmounted',
	'class',
	'style',
];

function createSchemaResolvers(typeChecker: ts.TypeChecker, symbolNode: ts.Expression) {
	function reducer(acc: any, cur: any) {
		acc[cur.name] = cur;
		return acc;
	}
	function resolveSymbolSchema(prop: ts.Symbol): PropertyMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!);
		typeChecker.getDefaultFromTypeParameter(subtype);

		return {
			name: prop.getEscapedName().toString(),
			description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
			tags: prop.getJsDocTags(typeChecker).map(tag => ({
				name: tag.name,
				text: tag.text?.map(part => part.text).join(''),
			})),
			required: !Boolean((prop.declarations?.[0] as ts.ParameterDeclaration)?.questionToken ?? false),
			type: typeChecker.typeToString(subtype),
			schema: resolveSchema(subtype),
		};
	}
	function resolveCallbackSchema(signature: ts.Signature): PropertyMetaSchema {
		return {
			kind: 'event',
			type: typeChecker.signatureToString(signature),
			schema: typeChecker.getTypeArguments(typeChecker.getTypeOfSymbolAtLocation(signature.parameters[0], symbolNode) as ts.TypeReference).map(resolveSchema)
		};
	}
	function resolveEventSchema(subtype: ts.Type): PropertyMetaSchema {
		return (subtype.getCallSignatures().length === 1)
			? resolveCallbackSchema(subtype.getCallSignatures()[0])
			: typeChecker.typeToString(subtype);
	}
	function resolveNestedSchema(subtype: ts.Type): PropertyMetaSchema {
		// !!(subtype.flags & ts.TypeFlags.Object)
		return (subtype.isClassOrInterface() || subtype.isIntersection())
			? {
				kind: 'object',
				type: typeChecker.typeToString(subtype),
				schema: subtype.getProperties().map(resolveSymbolSchema).reduce(reducer, {})
			}
			: resolveEventSchema(subtype);
	}
	function resolveArraySchema(subtype: ts.Type): PropertyMetaSchema {
		// @ts-ignore - typescript internal, isArrayLikeType exists
		return typeChecker.isArrayLikeType(subtype)
			? {
				kind: 'array',
				type: typeChecker.typeToString(subtype),
				schema: typeChecker.getTypeArguments(subtype as ts.TypeReference).map(resolveSchema)
			}
			: resolveNestedSchema(subtype);
	}
	function resolveSchema(subtype: ts.Type): PropertyMetaSchema {
		return subtype.isUnion()
			? {
				kind: 'enum',
				type: typeChecker.typeToString(subtype),
				schema: subtype.types.map(resolveArraySchema)
			}
			: resolveArraySchema(subtype);
	}

	return {
		resolveSymbolSchema,
		resolveCallbackSchema,
		resolveEventSchema,
		resolveNestedSchema,
		resolveArraySchema,
		resolveSchema,
	};
}

export function createComponentMetaChecker(tsconfigPath: string) {

	const parsedCommandLine = vue.tsShared.createParsedCommandLine(ts, {
		useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
		readDirectory: (path, extensions, exclude, include, depth) => {
			return ts.sys.readDirectory(path, [...extensions, '.vue'], exclude, include, depth);
		},
		fileExists: ts.sys.fileExists,
		readFile: ts.sys.readFile,
	}, tsconfigPath);
	const scriptSnapshot: Record<string, ts.IScriptSnapshot> = {};
	const core = vue.createLanguageContext({
		...ts.sys,
		getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options), // should use ts.getDefaultLibFilePath not ts.getDefaultLibFileName
		useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
		getCompilationSettings: () => parsedCommandLine.options,
		getScriptFileNames: () => {
			const result = [...parsedCommandLine.fileNames];
			for (const fileName of parsedCommandLine.fileNames) {
				if (fileName.endsWith('.vue')) {
					result.push(fileName + '.meta.ts');
				}
			}
			return result;
		},
		getProjectReferences: () => parsedCommandLine.projectReferences,
		getScriptVersion: (fileName) => '0',
		getScriptSnapshot: (fileName) => {
			if (!scriptSnapshot[fileName]) {
				const fileText = fileName.endsWith('.meta.ts') ? getMetaScriptContent(fileName) : ts.sys.readFile(fileName);
				if (fileText !== undefined) {
					scriptSnapshot[fileName] = ts.ScriptSnapshot.fromString(fileText);
				}
			}
			return scriptSnapshot[fileName];
		},
		getTypeScriptModule: () => ts,
		getVueCompilationSettings: () => parsedCommandLine.vueOptions,
	});
	const tsLs = ts.createLanguageService(core.typescriptLanguageServiceHost);
	const program = tsLs.getProgram()!;
	const typeChecker = program.getTypeChecker();

	return {
		getComponentMeta,
	};

	function getMetaScriptContent(fileName: string) {
		return `
			import Component from '${fileName.substring(0, fileName.length - '.meta.ts'.length)}';
			export default new Component();
		`;
	}

	function getComponentMeta(componentPath: string) {

		const sourceFile = program?.getSourceFile(componentPath + '.meta.ts');
		if (!sourceFile) {
			throw 'Could not find main source file';
		}

		const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
		if (!moduleSymbol) {
			throw 'Could not find module symbol';
		}

		const exportedSymbols = typeChecker.getExportsOfModule(moduleSymbol);

		let symbolNode: ts.Expression | undefined;

		for (const symbol of exportedSymbols) {

			const [declaration] = symbol.getDeclarations() ?? [];

			if (ts.isExportAssignment(declaration)) {
				symbolNode = declaration.expression;
			}
		}

		if (!symbolNode) {
			throw 'Could not find symbol node';
		}

		const symbolType = typeChecker.getTypeAtLocation(symbolNode);
		const symbolProperties = symbolType.getProperties();

		return {
			props: getProps(),
			events: getEvents(),
			slots: getSlots(),
			exposed: getExposed(),
		};

		function getProps() {

			const $props = symbolProperties.find(prop => prop.escapedName === '$props');

			if ($props) {
				const type = typeChecker.getTypeOfSymbolAtLocation($props, symbolNode!);
				const properties = type.getApparentProperties();
				const { resolveSymbolSchema } = createSchemaResolvers(typeChecker, symbolNode!);

				return properties.map(resolveSymbolSchema);
			}

			return [];
		}
		function getEvents() {

			const $emit = symbolProperties.find(prop => prop.escapedName === '$emit');

			if ($emit) {
				const type = typeChecker.getTypeOfSymbolAtLocation($emit, symbolNode!);
				const calls = type.getCallSignatures();
				const { resolveSchema } = createSchemaResolvers(typeChecker, symbolNode!);

				return calls.map(call => ({
					name: (typeChecker.getTypeOfSymbolAtLocation(call.parameters[0], symbolNode!) as ts.StringLiteralType).value,
					type: typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(call.parameters[1], symbolNode!)),
					signature: typeChecker.signatureToString(call),
					schema: typeChecker.getTypeArguments(typeChecker.getTypeOfSymbolAtLocation(call.parameters[1], symbolNode!) as ts.TypeReference).map(resolveSchema),
				}));
			}

			return [];
		}
		function getSlots() {

			const propertyName = (parsedCommandLine.vueOptions.target ?? 3) < 3 ? '$scopedSlots' : '$slots';
			const $slots = symbolProperties.find(prop => prop.escapedName === propertyName);

			if ($slots) {
				const type = typeChecker.getTypeOfSymbolAtLocation($slots, symbolNode!);
				const properties = type.getProperties();
				return properties.map(prop => ({
					name: prop.escapedName as string,
					propsType: typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode!).getCallSignatures()[0].parameters[0], symbolNode!)),
					// props: {}, // TODO
					description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
				}));
			}

			return [];
		}

		function getExposed() {

			const exposed = symbolProperties.filter(prop =>
				// only exposed props will have a syntheticOrigin
				Boolean((prop as any).syntheticOrigin)
			);

			if (exposed.length) {
				return exposed.map(expose => ({
					name: expose.escapedName as string,
					type: typeChecker.typeToString(typeChecker.getTypeOfSymbolAtLocation(expose, symbolNode!)),
					documentationComment: ts.displayPartsToString(expose.getDocumentationComment(typeChecker)),
				}));
			}

			return [];
		}
	}
}
