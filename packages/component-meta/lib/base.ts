import { createLanguageServiceHost, resolveFileLanguageId, type TypeScriptProjectHost } from '@volar/typescript';
import * as core from '@vue/language-core';
import { posix as path } from 'path-browserify';
import type * as ts from 'typescript';

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

// Utility function to get the component node from an AST
function getComponentNodeFromAst(
	ast: ts.SourceFile,
	exportName: string,
	ts: typeof import('typescript'),
): ts.Node | undefined {
	let result: ts.Node | undefined;

	if (exportName === 'default') {
		ast.forEachChild(child => {
			if (ts.isExportAssignment(child)) {
				result = child.expression;
			}
		});
	}
	else {
		ast.forEachChild(child => {
			if (
				ts.isVariableStatement(child)
				&& child.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)
			) {
				for (const dec of child.declarationList.declarations) {
					if (dec.name.getText(ast) === exportName) {
						result = dec.initializer;
					}
				}
			}
		});
	}

	return result;
}

// Utility function to get the component options node from a component node
function getComponentOptionsNodeFromComponent(
	component: ts.Node | undefined,
	ts: typeof import('typescript'),
): ts.ObjectLiteralExpression | undefined {
	if (component) {
		// export default { ... }
		if (ts.isObjectLiteralExpression(component)) {
			return component;
		}
		// export default defineComponent({ ... })
		else if (ts.isCallExpression(component)) {
			if (component.arguments.length) {
				const arg = component.arguments[0]!;
				if (ts.isObjectLiteralExpression(arg)) {
					return arg;
				}
			}
		}
	}

	return undefined;
}

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
		path.join(rootDir, 'jsconfig.json.global.vue'),
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
		tsconfig + '.global.vue',
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
	globalComponentName: string,
) {
	let [{ vueOptions, options, projectReferences }, fileNames] = getConfigAndFiles();
	/**
	 * Used to lookup if a file is referenced.
	 */
	let fileNamesSet = new Set(fileNames.map(path => path.replace(windowsPathReg, '/')));
	let projectVersion = 0;

	vueOptions.globalTypesPath = core.createGlobalTypesWriter(vueOptions, ts.sys.writeFile);

	const projectHost: TypeScriptProjectHost = {
		getCurrentDirectory: () => rootPath,
		getProjectVersion: () => projectVersion.toString(),
		getCompilationSettings: () => options,
		getScriptFileNames: () => [...fileNamesSet],
		getProjectReferences: () => projectReferences,
	};
	const globalComponentSnapshot = ts.ScriptSnapshot.fromString('<script setup lang="ts"></script>');
	const scriptSnapshots = new Map<string, ts.IScriptSnapshot | undefined>();
	const metaSnapshots = new Map<string, ts.IScriptSnapshot>();
	const getScriptFileNames = projectHost.getScriptFileNames;
	projectHost.getScriptFileNames = () => {
		const names = getScriptFileNames();
		return [
			...names,
			...names.map(getMetaFileName),
			globalComponentName,
			getMetaFileName(globalComponentName),
		];
	};

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

			if (fileName === globalComponentName) {
				snapshot = globalComponentSnapshot;
			}
			else if (isMetaFileName(fileName)) {
				if (!metaSnapshots.has(fileName)) {
					metaSnapshots.set(fileName, ts.ScriptSnapshot.fromString(getMetaScriptContent(fileName)));
				}
				snapshot = metaSnapshots.get(fileName);
			}
			else {
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
			}

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

	let globalPropNames: string[] | undefined;

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
			vueOptions.globalTypesPath = core.createGlobalTypesWriter(vueOptions, ts.sys.writeFile);
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
		/**
		 * @deprecated use `getProgram()` instead
		 */
		__internal__: {
			tsLs,
		},
	};

	function isMetaFileName(fileName: string) {
		return fileName.endsWith('.meta.ts');
	}

	function getMetaFileName(fileName: string) {
		return (
			vueOptions.extensions.some(ext => fileName.endsWith(ext))
				? fileName
				: fileName.slice(0, fileName.lastIndexOf('.'))
		) + '.meta.ts';
	}

	function getMetaScriptContent(fileName: string) {
		const helpersPath = require.resolve('vue-component-type-helpers').replace(windowsPathReg, '/');
		let helpersRelativePath = path.relative(path.dirname(fileName), helpersPath);
		if (!helpersRelativePath.startsWith('./') && !helpersRelativePath.startsWith('../')) {
			helpersRelativePath = './' + helpersRelativePath;
		}
		let code = `
import type { ComponentType, ComponentProps, ComponentEmit, ComponentSlots, ComponentExposed } from '${helpersRelativePath}';
import type * as Components from '${fileName.slice(0, -'.meta.ts'.length)}';

export default {} as { [K in keyof typeof Components]: ComponentMeta<typeof Components[K]>; };

interface ComponentMeta<T> {
	type: ComponentType<T>;
	props: ComponentProps<T>;
	emit: ComponentEmit<T>;
	slots: ComponentSlots<T>;
	exposed: ComponentExposed<T>;
}
`.trim();
		return code;
	}

	function getExportNames(componentPath: string) {
		const program = tsLs.getProgram()!;
		const typeChecker = program.getTypeChecker();
		return _getExports(program, typeChecker, componentPath).exports.map(e => e.getName());
	}

	function getComponentMeta(componentPath: string, exportName = 'default'): ComponentMeta {
		const program = tsLs.getProgram()!;
		const typeChecker = program.getTypeChecker();
		const { symbolNode, exports } = _getExports(program, typeChecker, componentPath);
		const _export = exports.find(property => property.getName() === exportName);

		if (!_export) {
			throw `Could not find export ${exportName}`;
		}

		const componentType = typeChecker.getTypeOfSymbolAtLocation(_export, symbolNode);
		const symbolProperties = componentType.getProperties();

		let _type: ReturnType<typeof getType> | undefined;
		let _props: ReturnType<typeof getProps> | undefined;
		let _events: ReturnType<typeof getEvents> | undefined;
		let _slots: ReturnType<typeof getSlots> | undefined;
		let _exposed: ReturnType<typeof getExposed> | undefined;
		let _name: string | undefined;
		let _description: string | undefined;

		const meta = {
			get name() {
				return _name ?? (_name = getName());
			},
			get description() {
				return _description ?? (_description = getDescription());
			},
			get type() {
				return _type ?? (_type = getType());
			},
			get props() {
				return _props ?? (_props = getProps());
			},
			get events() {
				return _events ?? (_events = getEvents());
			},
			get slots() {
				return _slots ?? (_slots = getSlots());
			},
			get exposed() {
				return _exposed ?? (_exposed = getExposed());
			},
		};

		return meta;

		function getType() {
			const $type = symbolProperties.find(prop => prop.escapedName === 'type');

			if ($type) {
				const type = typeChecker.getTypeOfSymbolAtLocation($type, symbolNode);
				return Number(typeChecker.typeToString(type));
			}

			return 0;
		}

		function getProps() {
			const $props = symbolProperties.find(prop => prop.escapedName === 'props');
			const vnodeEventRegex = /^onVnode[A-Z]/;
			let result: PropertyMeta[] = [];

			if ($props) {
				const type = typeChecker.getTypeOfSymbolAtLocation($props, symbolNode);
				const properties = type.getProperties();

				const eventProps = new Set(
					meta.events.map(event => `on${event.name.charAt(0).toUpperCase()}${event.name.slice(1)}`),
				);

				result = properties
					.map(prop => {
						const {
							resolveNestedProperties,
						} = createSchemaResolvers(typeChecker, symbolNode, checkerOptions, ts, language);

						return resolveNestedProperties(prop);
					})
					.filter(prop => !vnodeEventRegex.test(prop.name) && !eventProps.has(prop.name));
			}

			// fill global
			if (componentPath !== globalComponentName) {
				globalPropNames ??= getComponentMeta(globalComponentName).props.map(prop => prop.name);
				for (const prop of result) {
					prop.global = globalPropNames.includes(prop.name);
				}
			}

			// fill defaults
			const printer = ts.createPrinter(checkerOptions.printer);
			const sourceScript = language.scripts.get(componentPath)!;
			const { snapshot } = sourceScript;

			const vueFile = sourceScript.generated?.root;
			const vueDefaults = vueFile && exportName === 'default'
				? (vueFile instanceof core.VueVirtualCode ? readVueComponentDefaultProps(vueFile, printer, ts) : {})
				: {};
			const tsDefaults = !vueFile
				? readTsComponentDefaultProps(
					ts.createSourceFile(
						'/tmp.' + componentPath.slice(componentPath.lastIndexOf('.') + 1), // ts | js | tsx | jsx
						snapshot.getText(0, snapshot.getLength()),
						ts.ScriptTarget.Latest,
					),
					exportName,
					printer,
					ts,
				)
				: {};

			for (
				const [propName, defaultExp] of Object.entries({
					...vueDefaults,
					...tsDefaults,
				})
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
			const $emit = symbolProperties.find(prop => prop.escapedName === 'emit');

			if ($emit) {
				const type = typeChecker.getTypeOfSymbolAtLocation($emit, symbolNode);
				const calls = type.getCallSignatures();

				return calls.map(call => {
					const {
						resolveEventSignature,
					} = createSchemaResolvers(typeChecker, symbolNode, checkerOptions, ts, language);

					return resolveEventSignature(call);
				}).filter(event => event.name);
			}

			return [];
		}

		function getSlots() {
			const $slots = symbolProperties.find(prop => prop.escapedName === 'slots');

			if ($slots) {
				const type = typeChecker.getTypeOfSymbolAtLocation($slots, symbolNode);
				const properties = type.getProperties();

				return properties.map(prop => {
					const {
						resolveSlotProperties,
					} = createSchemaResolvers(typeChecker, symbolNode, checkerOptions, ts, language);

					return resolveSlotProperties(prop);
				});
			}

			return [];
		}

		function getExposed() {
			const $exposed = symbolProperties.find(prop => prop.escapedName === 'exposed');

			if ($exposed) {
				const $props = symbolProperties.find(prop => prop.escapedName === 'props');
				const propsProperties = $props ? typeChecker.getTypeOfSymbolAtLocation($props, symbolNode).getProperties() : [];
				const type = typeChecker.getTypeOfSymbolAtLocation($exposed, symbolNode);
				const properties = type.getProperties().filter(prop =>
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
					} = createSchemaResolvers(typeChecker, symbolNode, checkerOptions, ts, language);

					return resolveExposedProperties(prop);
				});
			}

			return [];
		}

		function getName() {
			// Try to get name from component options
			const sourceScript = language.scripts.get(componentPath)!;
			const { snapshot } = sourceScript;
			const vueFile = sourceScript.generated?.root;

			if (vueFile && exportName === 'default' && vueFile instanceof core.VueVirtualCode) {
				// For Vue SFC, check the script section
				const { sfc } = vueFile;
				if (sfc.script) {
					const name = readComponentName(sfc.script.ast, exportName, ts);
					if (name) {
						return name;
					}
				}
			}
			else if (!vueFile) {
				// For TS/JS files
				const ast = ts.createSourceFile(
					'/tmp.' + componentPath.slice(componentPath.lastIndexOf('.') + 1),
					snapshot.getText(0, snapshot.getLength()),
					ts.ScriptTarget.Latest,
				);
				return readComponentName(ast, exportName, ts);
			}

			return undefined;
		}

		function getDescription() {
			const sourceFile = program.getSourceFile(componentPath);
			if (sourceFile) {
				return readComponentDescription(sourceFile, exportName, ts, typeChecker);
			}
		}
	}

	function _getExports(
		program: ts.Program,
		typeChecker: ts.TypeChecker,
		componentPath: string,
	) {
		const sourceFile = program.getSourceFile(getMetaFileName(componentPath));
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

			if (declaration && ts.isExportAssignment(declaration)) {
				symbolNode = declaration.expression;
			}
		}

		if (!symbolNode) {
			throw 'Could not find symbol node';
		}

		const exportDefaultType = typeChecker.getTypeAtLocation(symbolNode);
		const exports = exportDefaultType.getProperties();

		return {
			symbolNode,
			exports,
		};
	}
}

function createSchemaResolvers(
	typeChecker: ts.TypeChecker,
	symbolNode: ts.Expression,
	{ rawType, schema: options, noDeclarations }: MetaCheckerOptions,
	ts: typeof import('typescript'),
	language: core.Language<string>,
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

		return {
			name: prop.getEscapedName().toString(),
			global: false,
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
	function resolveSlotProperties(prop: ts.Symbol): SlotMeta {
		const propType = typeChecker.getNonNullableType(typeChecker.getTypeOfSymbolAtLocation(prop, symbolNode));
		const signatures = propType.getCallSignatures();
		const paramType = signatures[0]?.parameters[0];
		const subtype = paramType ? typeChecker.getTypeOfSymbolAtLocation(paramType, symbolNode) : typeChecker.getAnyType();
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
			return undefined;
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

function readVueComponentDefaultProps(
	root: core.VueVirtualCode,
	printer: ts.Printer | undefined,
	ts: typeof import('typescript'),
) {
	let result: Record<string, {
		default?: string;
		required?: boolean;
	}> = {};
	const { sfc } = root;

	scriptSetupWorker();
	scriptWorker();

	return result;

	function scriptSetupWorker() {
		if (!sfc.scriptSetup) {
			return;
		}
		const { ast } = sfc.scriptSetup;

		const codegen = core.tsCodegen.get(sfc);
		const scriptSetupRanges = codegen?.getScriptSetupRanges();

		if (scriptSetupRanges?.withDefaults?.argNode) {
			const obj = findObjectLiteralExpression(scriptSetupRanges.withDefaults.argNode);
			if (obj) {
				for (const prop of obj.properties) {
					if (ts.isPropertyAssignment(prop)) {
						const name = prop.name.getText(ast);
						const expNode = resolveDefaultOptionExpression(prop.initializer, ts);
						const expText = printer?.printNode(ts.EmitHint.Expression, expNode, ast) ?? expNode.getText(ast);

						result[name] = {
							default: expText,
						};
					}
				}
			}
		}
		else if (scriptSetupRanges?.defineProps?.argNode) {
			const obj = findObjectLiteralExpression(scriptSetupRanges.defineProps.argNode);
			if (obj) {
				result = {
					...result,
					...resolvePropsOption(ast, obj, printer, ts),
				};
			}
		}
		else if (scriptSetupRanges?.defineProps?.destructured) {
			for (const [name, initializer] of scriptSetupRanges.defineProps.destructured) {
				if (initializer) {
					const expText = printer?.printNode(ts.EmitHint.Expression, initializer, ast) ?? initializer.getText(ast);
					result[name] = {
						default: expText,
					};
				}
			}
		}

		if (scriptSetupRanges?.defineModel) {
			for (const defineModel of scriptSetupRanges.defineModel) {
				const obj = defineModel.argNode ? findObjectLiteralExpression(defineModel.argNode) : undefined;
				if (obj) {
					const name = defineModel.name
						? sfc.scriptSetup.content.slice(defineModel.name.start, defineModel.name.end).slice(1, -1)
						: 'modelValue';
					result[name] = resolveModelOption(ast, obj, printer, ts);
				}
			}
		}

		function findObjectLiteralExpression(node: ts.Node) {
			if (ts.isObjectLiteralExpression(node)) {
				return node;
			}
			let result: ts.ObjectLiteralExpression | undefined;
			node.forEachChild(child => {
				if (!result) {
					result = findObjectLiteralExpression(child);
				}
			});
			return result;
		}
	}

	function scriptWorker() {
		if (!sfc.script) {
			return;
		}
		const { ast } = sfc.script;

		const scriptResult = readTsComponentDefaultProps(ast, 'default', printer, ts);
		for (const [key, value] of Object.entries(scriptResult)) {
			result[key] = value;
		}
	}
}

function readTsComponentDefaultProps(
	ast: ts.SourceFile,
	exportName: string,
	printer: ts.Printer | undefined,
	ts: typeof import('typescript'),
) {
	const props = getPropsNode();

	if (props) {
		return resolvePropsOption(ast, props, printer, ts);
	}

	return {};

	function getComponentNode() {
		return getComponentNodeFromAst(ast, exportName, ts);
	}

	function getComponentOptionsNode() {
		const component = getComponentNode();
		return getComponentOptionsNodeFromComponent(component, ts);
	}

	function getPropsNode() {
		const options = getComponentOptionsNode();
		const props = options?.properties.find(prop => prop.name?.getText(ast) === 'props');
		if (props && ts.isPropertyAssignment(props)) {
			if (ts.isObjectLiteralExpression(props.initializer)) {
				return props.initializer;
			}
		}
	}
}

function resolvePropsOption(
	ast: ts.SourceFile,
	props: ts.ObjectLiteralExpression,
	printer: ts.Printer | undefined,
	ts: typeof import('typescript'),
) {
	const result: Record<string, { default?: string; required?: boolean }> = {};

	for (const prop of props.properties) {
		if (ts.isPropertyAssignment(prop)) {
			const name = prop.name.getText(ast);
			if (ts.isObjectLiteralExpression(prop.initializer)) {
				const defaultProp = prop.initializer.properties.find(p =>
					ts.isPropertyAssignment(p) && p.name.getText(ast) === 'default'
				) as ts.PropertyAssignment | undefined;
				const requiredProp = prop.initializer.properties.find(p =>
					ts.isPropertyAssignment(p) && p.name.getText(ast) === 'required'
				) as ts.PropertyAssignment | undefined;

				result[name] = {};

				if (requiredProp) {
					const exp = requiredProp.initializer.getText(ast);
					result[name].required = exp === 'true';
				}
				if (defaultProp) {
					const expNode = resolveDefaultOptionExpression(defaultProp.initializer, ts);
					const expText = printer?.printNode(ts.EmitHint.Expression, expNode, ast) ?? expNode.getText(ast);
					result[name].default = expText;
				}
			}
		}
	}

	return result;
}

function resolveModelOption(
	ast: ts.SourceFile,
	options: ts.ObjectLiteralExpression,
	printer: ts.Printer | undefined,
	ts: typeof import('typescript'),
) {
	const result: { default?: string } = {};

	for (const prop of options.properties) {
		if (ts.isPropertyAssignment(prop)) {
			const name = prop.name.getText(ast);
			if (name === 'default') {
				const expNode = resolveDefaultOptionExpression(prop.initializer, ts);
				const expText = printer?.printNode(ts.EmitHint.Expression, expNode, ast) ?? expNode.getText(ast);
				result.default = expText;
			}
		}
	}

	return result;
}

function resolveDefaultOptionExpression(
	_default: ts.Expression,
	ts: typeof import('typescript'),
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

function readComponentName(
	ast: ts.SourceFile,
	exportName: string,
	ts: typeof import('typescript'),
): string | undefined {
	const componentNode = getComponentNodeFromAst(ast, exportName, ts);
	const optionsNode = getComponentOptionsNodeFromComponent(componentNode, ts);

	if (optionsNode) {
		const nameProp = optionsNode.properties.find(
			prop => ts.isPropertyAssignment(prop) && prop.name?.getText(ast) === 'name',
		);

		if (nameProp && ts.isPropertyAssignment(nameProp) && ts.isStringLiteral(nameProp.initializer)) {
			return nameProp.initializer.text;
		}
	}

	return undefined;
}

function readComponentDescription(
	ast: ts.SourceFile,
	exportName: string,
	ts: typeof import('typescript'),
	typeChecker: ts.TypeChecker,
): string | undefined {
	const exportNode = getExportNode();

	if (exportNode) {
		// Try to get JSDoc comments from the node using TypeScript API
		const jsDocComments = ts.getJSDocCommentsAndTags(exportNode);
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
		const symbol = typeChecker.getSymbolAtLocation(exportNode);
		if (symbol) {
			const description = ts.displayPartsToString(symbol.getDocumentationComment(typeChecker));
			return description || undefined;
		}
	}

	return undefined;

	function getExportNode() {
		let result: ts.Node | undefined;

		if (exportName === 'default') {
			ast.forEachChild(child => {
				if (ts.isExportAssignment(child)) {
					// Return the export assignment itself, not the expression
					result = child;
				}
			});
		}
		else {
			ast.forEachChild(child => {
				if (
					ts.isVariableStatement(child)
					&& child.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)
				) {
					// Return the variable statement itself
					result = child;
				}
			});
		}

		return result;
	}
}
