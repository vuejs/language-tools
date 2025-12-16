import { createLanguageServiceHost, resolveFileLanguageId, type TypeScriptProjectHost } from '@volar/typescript';
import * as core from '@vue/language-core';
import { posix as path } from 'path-browserify';
import type * as ts from 'typescript';
import {
	inferComponentEmit,
	inferComponentExposed,
	inferComponentProps,
	inferComponentSlots,
	inferComponentType,
} from './helpers';

import type {
	ComponentMeta,
	Declaration,
	EventMeta,
	ExposeMeta,
	MetaCheckerOptions,
	PropertyMeta,
	PropertyMetaSchema,
	SlotMeta,
} from './types';

export * from './types';

const windowsPathReg = /\\/g;

export function createCheckerByJsonConfigBase(
	ts: typeof import('typescript'),
	rootDir: string,
	json: any,
	checkerOptions: MetaCheckerOptions = {},
) {
	rootDir = rootDir.replace(windowsPathReg, '/');
	return baseCreate(
		ts,
		() => {
			const commandLine = core.createParsedCommandLineByJson(ts, ts.sys, rootDir, json);
			const { fileNames } = ts.parseJsonConfigFileContent(
				json,
				ts.sys,
				rootDir,
				{},
				undefined,
				undefined,
				core.getAllExtensions(commandLine.vueOptions)
					.map(extension => ({
						extension: extension.slice(1),
						isMixedContent: true,
						scriptKind: ts.ScriptKind.Deferred,
					})),
			);
			return [commandLine, fileNames];
		},
		checkerOptions,
		rootDir,
	);
}

export function createCheckerBase(
	ts: typeof import('typescript'),
	tsconfig: string,
	checkerOptions: MetaCheckerOptions = {},
) {
	tsconfig = tsconfig.replace(windowsPathReg, '/');
	return baseCreate(
		ts,
		() => {
			const commandLine = core.createParsedCommandLine(ts, ts.sys, tsconfig);
			const { fileNames } = ts.parseJsonSourceFileConfigFileContent(
				ts.readJsonConfigFile(tsconfig, ts.sys.readFile),
				ts.sys,
				path.dirname(tsconfig),
				{},
				tsconfig,
				undefined,
				core.getAllExtensions(commandLine.vueOptions)
					.map(extension => ({
						extension: extension.slice(1),
						isMixedContent: true,
						scriptKind: ts.ScriptKind.Deferred,
					})),
			);
			return [commandLine, fileNames];
		},
		checkerOptions,
		path.dirname(tsconfig),
	);
}

function baseCreate(
	ts: typeof import('typescript'),
	getConfigAndFiles: () => [
		commandLine: core.ParsedCommandLine,
		fileNames: string[],
	],
	checkerOptions: MetaCheckerOptions,
	rootPath: string,
) {
	let [{ vueOptions, options, projectReferences }, fileNames] = getConfigAndFiles();
	/**
	 * Used to lookup if a file is referenced.
	 */
	let fileNamesSet = new Set(fileNames.map(path => path.replace(windowsPathReg, '/')));
	let projectVersion = 0;

	const scriptRangesCache = new WeakMap<ts.SourceFile, core.ScriptRanges>();
	const projectHost: TypeScriptProjectHost = {
		getCurrentDirectory: () => rootPath,
		getProjectVersion: () => projectVersion.toString(),
		getCompilationSettings: () => options,
		getScriptFileNames: () => [...fileNamesSet],
		getProjectReferences: () => projectReferences,
	};
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot | undefined>();
	const vueLanguagePlugin = core.createVueLanguagePlugin<string>(
		ts,
		projectHost.getCompilationSettings(),
		vueOptions,
		id => id,
	);
	const language = core.createLanguage(
		[
			vueLanguagePlugin,
			{
				getLanguageId(fileName) {
					return resolveFileLanguageId(fileName);
				},
			},
		],
		new core.FileMap(ts.sys.useCaseSensitiveFileNames),
		fileName => {
			let snapshot = scriptSnapshots.get(fileName);

			if (!scriptSnapshots.has(fileName)) {
				const fileText = ts.sys.readFile(fileName);
				if (fileText !== undefined) {
					scriptSnapshots.set(fileName, ts.ScriptSnapshot.fromString(fileText));
				}
				else {
					scriptSnapshots.set(fileName, undefined);
				}
			}
			snapshot = scriptSnapshots.get(fileName);

			if (snapshot) {
				language.scripts.set(fileName, snapshot);
			}
			else {
				language.scripts.delete(fileName);
			}
		},
	);
	const { languageServiceHost } = createLanguageServiceHost(ts, ts.sys, language, s => s, projectHost);
	const tsLs = ts.createLanguageService(languageServiceHost);
	const printer = ts.createPrinter(checkerOptions.printer);

	if (checkerOptions.forceUseTs) {
		const getScriptKind = languageServiceHost.getScriptKind?.bind(languageServiceHost);
		languageServiceHost.getScriptKind = fileName => {
			const scriptKind = getScriptKind!(fileName);
			if (vueOptions.extensions.some(ext => fileName.endsWith(ext))) {
				if (scriptKind === ts.ScriptKind.JS) {
					return ts.ScriptKind.TS;
				}
				if (scriptKind === ts.ScriptKind.JSX) {
					return ts.ScriptKind.TSX;
				}
			}
			return scriptKind;
		};
	}

	return {
		getExportNames,
		getComponentMeta,
		updateFile(fileName: string, text: string) {
			fileName = fileName.replace(windowsPathReg, '/');
			scriptSnapshots.set(fileName, ts.ScriptSnapshot.fromString(text));
			// Ensure the file is referenced
			fileNamesSet.add(fileName);
			projectVersion++;
		},
		deleteFile(fileName: string) {
			fileName = fileName.replace(windowsPathReg, '/');
			fileNamesSet.delete(fileName);
			projectVersion++;
		},
		reload() {
			[{ vueOptions, options, projectReferences }, fileNames] = getConfigAndFiles();
			fileNamesSet = new Set(fileNames.map(path => path.replace(windowsPathReg, '/')));
			this.clearCache();
		},
		clearCache() {
			scriptSnapshots.clear();
			projectVersion++;
		},
		getProgram() {
			return tsLs.getProgram();
		},
	};

	function getExportNames(componentPath: string) {
		const program = tsLs.getProgram()!;
		const sourceFile = program.getSourceFile(componentPath);
		if (sourceFile) {
			const scriptRanges = getScriptRanges(sourceFile);
			return Object.keys(scriptRanges.exports);
		}
	}

	function getComponentMeta(componentPath: string, exportName = 'default'): ComponentMeta {
		let program = tsLs.getProgram()!;
		let sourceFile = program.getSourceFile(componentPath);
		if (!sourceFile) {
			fileNamesSet.add(componentPath);
			projectVersion++;
			program = tsLs.getProgram()!;
			sourceFile = program.getSourceFile(componentPath);
			if (!sourceFile) {
				throw `Could not find component file: ${componentPath}`;
			}
		}

		const scriptRanges = getScriptRanges(sourceFile);
		const component = scriptRanges.exports[exportName];
		if (!component) {
			throw `Could not find export ${exportName}`;
		}

		const symbolNode = component.expression.node;
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
			return inferComponentType(typeChecker, symbolNode) ?? 0;
		}

		function getProps() {
			const propsType = inferComponentProps(typeChecker, symbolNode);
			const vnodeEventRegex = /^onVnode[A-Z]/;
			let result: PropertyMeta[] = [];

			if (propsType) {
				const properties = propsType.getProperties();

				const eventProps = new Set(
					meta.events.map(event => `on${event.name.charAt(0).toUpperCase()}${event.name.slice(1)}`),
				);

				result = properties
					.map(prop => {
						const {
							resolveNestedProperties,
						} = createSchemaResolvers(ts, typeChecker, language, symbolNode, checkerOptions);

						return resolveNestedProperties(prop);
					})
					.filter(prop => !vnodeEventRegex.test(prop.name) && !eventProps.has(prop.name));
			}

			// fill defaults
			const sourceScript = language.scripts.get(componentPath);
			const sourceFile = program.getSourceFile(componentPath);
			const scriptRanges = sourceFile ? getScriptRanges(sourceFile) : undefined;
			const vueFile = sourceScript?.generated?.root;
			const defaults = sourceFile && scriptRanges
				? readDefaultsFromScript(
					ts,
					printer,
					sourceFile,
					scriptRanges,
					exportName,
				)
				: {};
			const virtualCode = vueFile ? getVirtualCode(componentPath) : undefined;
			const scriptSetupRanges = virtualCode ? getScriptSetupRanges(virtualCode) : undefined;

			if (virtualCode?.sfc.scriptSetup && scriptSetupRanges) {
				Object.assign(
					defaults,
					readDefaultsFromScriptSetup(
						ts,
						printer,
						virtualCode.sfc.scriptSetup.ast,
						scriptSetupRanges,
					),
				);
			}

			for (
				const [propName, defaultExp] of Object.entries(defaults)
			) {
				const prop = result.find(p => p.name === propName);
				if (prop) {
					prop.default = defaultExp.default;

					if (defaultExp.required !== undefined) {
						prop.required = defaultExp.required;
					}

					if (prop.default !== undefined) {
						prop.required = false; // props with default are always optional
					}
				}
			}

			return result;
		}

		function getEvents() {
			const emitType = inferComponentEmit(typeChecker, symbolNode);

			if (emitType) {
				const calls = emitType.getCallSignatures();

				return calls.map(call => {
					const {
						resolveEventSignature,
					} = createSchemaResolvers(ts, typeChecker, language, symbolNode, checkerOptions);

					return resolveEventSignature(call);
				}).filter(event => event.name);
			}

			return [];
		}

		function getSlots() {
			const slotsType = inferComponentSlots(typeChecker, symbolNode);

			if (slotsType) {
				const properties = slotsType.getProperties();

				return properties.map(prop => {
					const {
						resolveSlotProperties,
					} = createSchemaResolvers(ts, typeChecker, language, symbolNode, checkerOptions);

					return resolveSlotProperties(prop);
				});
			}

			return [];
		}

		function getExposed() {
			const exposedType = inferComponentExposed(typeChecker, symbolNode);

			if (exposedType) {
				const propsType = inferComponentProps(typeChecker, symbolNode);
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
					} = createSchemaResolvers(ts, typeChecker, language, symbolNode, checkerOptions);

					return resolveExposedProperties(prop);
				});
			}

			return [];
		}

		function getName() {
			const sourceFile = program.getSourceFile(componentPath);
			if (sourceFile) {
				const scriptRanges = getScriptRanges(sourceFile);
				const name = scriptRanges?.exports[exportName]?.options?.name;
				if (name && ts.isStringLiteral(name.node)) {
					return name.node.text;
				}
			}
		}

		function getDescription() {
			const sourceFile = program.getSourceFile(componentPath);
			if (sourceFile) {
				const scriptRanges = getScriptRanges(sourceFile);
				return readComponentDescription(ts, scriptRanges, exportName, typeChecker);
			}
		}
	}

	function getScriptRanges(sourceFile: ts.SourceFile) {
		let scriptRanges = scriptRangesCache.get(sourceFile);
		if (!scriptRanges) {
			scriptRanges = core.parseScriptRanges(ts, sourceFile, vueOptions);
			scriptRangesCache.set(sourceFile, scriptRanges);
		}
		return scriptRanges;
	}

	function getVirtualCode(fileName: string) {
		const sourceScript = language.scripts.get(fileName);
		const vueFile = sourceScript?.generated?.root;
		if (vueFile instanceof core.VueVirtualCode) {
			return vueFile;
		}
	}

	function getScriptSetupRanges(virtualCode: core.VueVirtualCode) {
		const { sfc } = virtualCode;
		const codegen = core.tsCodegen.get(sfc);
		return codegen?.getScriptSetupRanges();
	}
}

function createSchemaResolvers(
	ts: typeof import('typescript'),
	typeChecker: ts.TypeChecker,
	language: core.Language<string>,
	symbolNode: ts.Expression,
	{ rawType, schema: options, noDeclarations }: MetaCheckerOptions,
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

	function resolveNestedProperties(prop: ts.Symbol): PropertyMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode);
		let schema: PropertyMetaSchema | undefined;
		let declarations: Declaration[] | undefined;
		let global = false;

		for (const decl of prop.declarations ?? []) {
			if (
				decl.getSourceFile() !== symbolNode.getSourceFile()
				&& isPublicProp(decl)
			) {
				global = true;
			}
		}

		return {
			name: prop.getEscapedName().toString(),
			global,
			description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
			tags: getJsDocTags(prop),
			required: !(prop.flags & ts.SymbolFlags.Optional),
			type: getFullyQualifiedName(subtype),
			get declarations() {
				return declarations ??= getDeclarations(prop.declarations ?? []);
			},
			get schema() {
				return schema ??= resolveSchema(subtype);
			},
			rawType: rawType ? subtype : undefined,
			getTypeObject() {
				return subtype;
			},
		};
	}

	function isPublicProp(declaration: ts.Declaration): boolean {
		const publicInterfaces = new Set([
			'PublicProps',
			'VNodeProps',
			'AllowedComponentProps',
			'ComponentCustomProps',
		]);
		let parent = declaration.parent;
		while (parent) {
			if (ts.isInterfaceDeclaration(parent) || ts.isTypeAliasDeclaration(parent)) {
				if (publicInterfaces.has(parent.name.text)) {
					return true;
				}
				return false;
			}
			parent = parent.parent;
		}
		return false;
	}

	function resolveSlotProperties(prop: ts.Symbol): SlotMeta {
		const propType = typeChecker.getNonNullableType(typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode));
		const signatures = propType.getCallSignatures();
		const paramType = signatures[0]?.parameters[0];
		const subtype = paramType
			? typeChecker.getTypeOfSymbolAtLocation(paramType, symbolNode)
			: typeChecker.getAnyType();
		let schema: PropertyMetaSchema | undefined;
		let declarations: Declaration[] | undefined;

		return {
			name: prop.getName(),
			type: getFullyQualifiedName(subtype),
			description: ts.displayPartsToString(prop.getDocumentationComment(typeChecker)),
			tags: getJsDocTags(prop),
			get declarations() {
				return declarations ??= getDeclarations(prop.declarations ?? []);
			},
			get schema() {
				return schema ??= resolveSchema(subtype);
			},
			rawType: rawType ? subtype : undefined,
			getTypeObject() {
				return subtype;
			},
		};
	}
	function resolveExposedProperties(expose: ts.Symbol): ExposeMeta {
		const subtype = typeChecker.getTypeOfSymbolAtLocation(expose, symbolNode);
		let schema: PropertyMetaSchema | undefined;
		let declarations: Declaration[] | undefined;

		return {
			name: expose.getName(),
			type: getFullyQualifiedName(subtype),
			description: ts.displayPartsToString(expose.getDocumentationComment(typeChecker)),
			tags: getJsDocTags(expose),
			get declarations() {
				return declarations ??= getDeclarations(expose.declarations ?? []);
			},
			get schema() {
				return schema ??= resolveSchema(subtype);
			},
			rawType: rawType ? subtype : undefined,
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
			subtype = typeChecker.getTypeOfSymbolAtLocation(symbol, symbolNode);
			if ((call.parameters[1]!.valueDeclaration as any)?.dotDotDotToken) {
				subtypeStr = getFullyQualifiedName(subtype);
				getSchema = () => typeChecker.getTypeArguments(subtype! as ts.TypeReference).map(resolveSchema);
			}
			else {
				subtypeStr = '[';
				for (let i = 1; i < call.parameters.length; i++) {
					subtypeStr += getFullyQualifiedName(typeChecker.getTypeOfSymbolAtLocation(call.parameters[i]!, symbolNode))
						+ ', ';
				}
				subtypeStr = subtypeStr.slice(0, -2) + ']';
				getSchema = () => {
					const result: PropertyMetaSchema[] = [];
					for (let i = 1; i < call.parameters.length; i++) {
						result.push(resolveSchema(typeChecker.getTypeOfSymbolAtLocation(call.parameters[i]!, symbolNode)));
					}
					return result;
				};
			}
		}

		return {
			name: (typeChecker.getTypeOfSymbolAtLocation(call.parameters[0]!, symbolNode) as ts.StringLiteralType).value,
			description: ts.displayPartsToString(call.getDocumentationComment(typeChecker)),
			tags: getJsDocTags(call),
			type: subtypeStr,
			signature: typeChecker.signatureToString(call),
			get declarations() {
				return declarations ??= call.declaration ? getDeclarations([call.declaration]) : [];
			},
			get schema() {
				return schema ??= getSchema();
			},
			rawType: rawType ? subtype : undefined,
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
							typeChecker.getTypeOfSymbolAtLocation(signature.parameters[0]!, symbolNode) as ts.TypeReference,
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
		if (noDeclarations) {
			return [];
		}
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

function readDefaultsFromScriptSetup(
	ts: typeof import('typescript'),
	printer: ts.Printer,
	sourceFile: ts.SourceFile,
	scriptSetupRanges: core.ScriptSetupRanges,
) {
	const result: Record<string, { default?: string }> = {};

	if (scriptSetupRanges.withDefaults?.arg) {
		const obj = findObjectLiteralExpression(ts, scriptSetupRanges.withDefaults.arg.node);
		if (obj) {
			for (const prop of obj.properties) {
				if (ts.isPropertyAssignment(prop)) {
					const name = prop.name.getText(sourceFile);
					const expNode = resolveDefaultOptionExpression(ts, prop.initializer);
					const expText = printer.printNode(ts.EmitHint.Expression, expNode, sourceFile)
						?? expNode.getText(sourceFile);
					result[name] = { default: expText };
				}
			}
		}
	}
	else if (scriptSetupRanges.defineProps?.arg) {
		const obj = findObjectLiteralExpression(ts, scriptSetupRanges.defineProps.arg.node);
		if (obj) {
			Object.assign(
				result,
				resolvePropsOption(ts, printer, sourceFile, obj),
			);
		}
	}
	else if (scriptSetupRanges.defineProps?.destructured) {
		for (const [name, initializer] of scriptSetupRanges.defineProps.destructured) {
			if (initializer) {
				const expText = printer.printNode(ts.EmitHint.Expression, initializer, sourceFile)
					?? initializer.getText(sourceFile);
				result[name] = { default: expText };
			}
		}
	}

	if (scriptSetupRanges.defineModel) {
		for (const defineModel of scriptSetupRanges.defineModel) {
			const obj = defineModel.arg ? findObjectLiteralExpression(ts, defineModel.arg.node) : undefined;
			if (obj) {
				const name = defineModel.name
					? sourceFile.text.slice(defineModel.name.start, defineModel.name.end).slice(1, -1)
					: 'modelValue';
				result[name] = { default: resolveModelOption(ts, printer, sourceFile, obj) };
			}
		}
	}

	return result;
}

function findObjectLiteralExpression(
	ts: typeof import('typescript'),
	node: ts.Node,
) {
	if (ts.isObjectLiteralExpression(node)) {
		return node;
	}
	let result: ts.ObjectLiteralExpression | undefined;
	node.forEachChild(child => {
		if (!result) {
			result = findObjectLiteralExpression(ts, child);
		}
	});
	return result;
}

function readDefaultsFromScript(
	ts: typeof import('typescript'),
	printer: ts.Printer,
	sourceFile: ts.SourceFile,
	scriptRanges: core.ScriptRanges,
	exportName: string,
) {
	const component = scriptRanges.exports[exportName];
	if (!component) {
		return {};
	}
	const props = component?.options?.args.node.properties.find(prop => prop.name?.getText(sourceFile) === 'props');
	if (props && ts.isPropertyAssignment(props)) {
		if (ts.isObjectLiteralExpression(props.initializer)) {
			return resolvePropsOption(ts, printer, sourceFile, props.initializer);
		}
	}
	return {};
}

function resolvePropsOption(
	ts: typeof import('typescript'),
	printer: ts.Printer,
	sourceFile: ts.SourceFile,
	props: ts.ObjectLiteralExpression,
) {
	const result: Record<string, { default?: string; required?: boolean }> = {};

	for (const prop of props.properties) {
		if (ts.isPropertyAssignment(prop)) {
			const name = prop.name.getText(sourceFile);
			if (ts.isObjectLiteralExpression(prop.initializer)) {
				const defaultProp = prop.initializer.properties.find(p =>
					ts.isPropertyAssignment(p) && p.name.getText(sourceFile) === 'default'
				) as ts.PropertyAssignment | undefined;
				const requiredProp = prop.initializer.properties.find(p =>
					ts.isPropertyAssignment(p) && p.name.getText(sourceFile) === 'required'
				) as ts.PropertyAssignment | undefined;

				result[name] = {};

				if (requiredProp) {
					const exp = requiredProp.initializer.getText(sourceFile);
					result[name].required = exp === 'true';
				}
				if (defaultProp) {
					const expNode = resolveDefaultOptionExpression(ts, defaultProp.initializer);
					const expText = printer.printNode(ts.EmitHint.Expression, expNode, sourceFile)
						?? expNode.getText(sourceFile);
					result[name].default = expText;
				}
			}
		}
	}

	return result;
}

function resolveModelOption(
	ts: typeof import('typescript'),
	printer: ts.Printer,
	sourceFile: ts.SourceFile,
	options: ts.ObjectLiteralExpression,
) {
	let _default: string | undefined;

	for (const prop of options.properties) {
		if (ts.isPropertyAssignment(prop)) {
			const name = prop.name.getText(sourceFile);
			if (name === 'default') {
				const expNode = resolveDefaultOptionExpression(ts, prop.initializer);
				const expText = printer.printNode(ts.EmitHint.Expression, expNode, sourceFile) ?? expNode.getText(sourceFile);
				_default = expText;
			}
		}
	}

	return _default;
}

function resolveDefaultOptionExpression(
	ts: typeof import('typescript'),
	_default: ts.Expression,
) {
	if (ts.isArrowFunction(_default)) {
		if (ts.isBlock(_default.body)) {
			return _default; // TODO
		}
		else if (ts.isParenthesizedExpression(_default.body)) {
			return _default.body.expression;
		}
		else {
			return _default.body;
		}
	}
	return _default;
}

function readComponentDescription(
	ts: typeof import('typescript'),
	scriptRanges: core.ScriptRanges,
	exportName: string,
	typeChecker: ts.TypeChecker,
): string | undefined {
	const _export = scriptRanges.exports[exportName];

	if (_export) {
		// Try to get JSDoc comments from the node using TypeScript API
		const jsDocComments = ts.getJSDocCommentsAndTags(_export.node);
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
		const symbol = typeChecker.getSymbolAtLocation(_export.node);
		if (symbol) {
			const description = ts.displayPartsToString(symbol.getDocumentationComment(typeChecker));
			return description || undefined;
		}
	}
}
