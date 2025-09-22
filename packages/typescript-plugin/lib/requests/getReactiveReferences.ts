import { createProxyLanguageService, decorateLanguageServiceHost } from '@volar/typescript';
import { collectBindingRanges, hyphenateAttr, type Language, type SourceScript } from '@vue/language-core';
import type * as ts from 'typescript';

const enum ReactiveAccessType {
	ValueProperty,
	AnyProperty,
	Call,
}

interface TSNode {
	ast: ts.Node;
	start: number;
	end: number;
}

interface ReactiveNode {
	isDependency: boolean;
	isDependent: boolean;
	binding?: TSNode & {
		accessTypes: ReactiveAccessType[];
	};
	accessor?: TSNode & {
		requiredAccess: boolean;
	};
	callback?: TSNode;
}

let currentVersion = -1;
let currentFileName = '';
let currentSnapshot: ts.IScriptSnapshot | undefined;
let languageService: ts.LanguageService | undefined;
let languageServiceHost: ts.LanguageServiceHost | undefined;

const analyzeCache = new WeakMap<ts.SourceFile, ReturnType<typeof analyze>>();

export function getReactiveReferences(
	ts: typeof import('typescript'),
	language: Language<string>,
	sourceScript: SourceScript<string>,
	position: number,
	leadingOffset: number = 0,
) {
	if (currentSnapshot !== sourceScript.snapshot || currentFileName !== sourceScript.id) {
		currentSnapshot = sourceScript.snapshot;
		currentFileName = sourceScript.id;
		currentVersion++;
	}
	if (!languageService) {
		languageServiceHost = {
			getProjectVersion: () => currentVersion.toString(),
			getScriptVersion: () => currentVersion.toString(),
			getScriptFileNames: () => [currentFileName],
			getScriptSnapshot: fileName => fileName === currentFileName ? currentSnapshot : undefined,
			getCompilationSettings: () => ({ allowJs: true, allowNonTsExtensions: true }),
			getCurrentDirectory: () => '',
			getDefaultLibFileName: () => '',
			readFile: () => undefined,
			fileExists: fileName => fileName === currentFileName,
		};
		decorateLanguageServiceHost(ts, language, languageServiceHost);
		const proxied = createProxyLanguageService(ts.createLanguageService(languageServiceHost));
		proxied.initialize(language);
		languageService = proxied.proxy;
	}
	return getReactiveReferencesWorker(ts, language, languageService, sourceScript, position, leadingOffset);
}

function getReactiveReferencesWorker(
	ts: typeof import('typescript'),
	language: Language<string>,
	languageService: ts.LanguageService,
	sourceScript: SourceScript<string>,
	position: number,
	leadingOffset: number,
) {
	const serviceScript = sourceScript.generated?.languagePlugin.typescript?.getServiceScript(
		sourceScript.generated.root,
	);
	const map = serviceScript ? language.maps.get(serviceScript.code, sourceScript) : undefined;
	const toSourceRange = map
		? (start: number, end: number) => {
			for (const [mappedStart, mappedEnd] of map.toSourceRange(start - leadingOffset, end - leadingOffset, false)) {
				return { start: mappedStart, end: mappedEnd };
			}
		}
		: (start: number, end: number) => ({ start, end });

	const toSourceNode = (node: ts.Node, endNode = node) => {
		const sourceRange = toSourceRange(node.getStart(sourceFile), endNode.end);
		if (sourceRange) {
			return { ...sourceRange, ast: node };
		}
	};
	const sourceFile = languageService.getProgram()!.getSourceFile(sourceScript.id)!;

	if (!analyzeCache.has(sourceFile)) {
		analyzeCache.set(sourceFile, analyze(ts, sourceFile, toSourceRange, toSourceNode));
	}

	const {
		signals,
		allValuePropertyAccess,
		allPropertyAccess,
		allFunctionCalls,
	} = analyzeCache.get(sourceFile)!;

	const info = findSignalByBindingRange(position) ?? findSignalByCallbackRange(position);
	if (!info) {
		return;
	}

	const dependents = info.binding ? findDependents(info.binding.ast, info.binding.accessTypes) : [];
	const dependencies = findDependencies(info);

	if ((!info.isDependent && !dependents.length) || (!info.isDependency && !dependencies.length)) {
		return;
	}

	const dependencyRanges: { start: number; end: number }[] = [];
	const dependentRanges: { start: number; end: number }[] = [];

	for (const dependency of dependencies) {
		let { ast } = dependency;
		if (ts.isBlock(ast) && ast.statements.length) {
			const sourceRange = toSourceNode(
				ast.statements[0]!,
				ast.statements[ast.statements.length - 1],
			);
			if (sourceRange) {
				dependencyRanges.push({ start: sourceRange.start, end: sourceRange.end });
			}
		}
		else {
			dependencyRanges.push({ start: dependency.start, end: dependency.end });
		}
	}
	for (const { callback } of dependents) {
		if (!callback) {
			continue;
		}
		if (ts.isBlock(callback.ast) && callback.ast.statements.length) {
			const { statements } = callback.ast;
			const sourceRange = toSourceNode(
				statements[0]!,
				statements[statements.length - 1],
			);
			if (sourceRange) {
				dependentRanges.push({ start: sourceRange.start, end: sourceRange.end });
			}
		}
		else {
			dependentRanges.push({ start: callback.start, end: callback.end });
		}
	}

	return { dependencyRanges, dependentRanges };

	function findDependencies(signal: ReactiveNode, visited = new Set<ReactiveNode>()) {
		if (visited.has(signal)) {
			return [];
		}
		visited.add(signal);

		const nodes: TSNode[] = [];
		let hasDependency = signal.isDependency;

		if (signal.accessor) {
			const { requiredAccess } = signal.accessor;
			visit(signal.accessor, requiredAccess);
			signal.accessor.ast.forEachChild(child => {
				const childRange = toSourceNode(child);
				if (childRange) {
					visit(
						childRange,
						requiredAccess,
					);
				}
			});
		}

		if (!hasDependency) {
			return [];
		}

		return nodes;

		function visit(node: TSNode, requiredAccess: boolean, parentIsPropertyAccess = false) {
			if (!requiredAccess) {
				if (!parentIsPropertyAccess && ts.isIdentifier(node.ast)) {
					const definition = languageService.getDefinitionAtPosition(sourceFile.fileName, node.start);
					for (const info of definition ?? []) {
						if (info.fileName !== sourceFile.fileName) {
							continue;
						}
						const signal = findSignalByBindingRange(info.textSpan.start);
						if (!signal) {
							continue;
						}
						if (signal.binding) {
							nodes.push(signal.binding);
							hasDependency ||= signal.isDependency;
						}
						if (signal.callback) {
							nodes.push(signal.callback);
						}
						const deps = findDependencies(signal, visited);
						nodes.push(...deps);
						hasDependency ||= deps.length > 0;
					}
				}
			}
			else if (
				ts.isPropertyAccessExpression(node.ast) || ts.isElementAccessExpression(node.ast)
				|| ts.isCallExpression(node.ast)
			) {
				const definition = languageService.getDefinitionAtPosition(
					sourceFile.fileName,
					node.start,
				);
				for (const info of definition ?? []) {
					if (info.fileName !== sourceFile.fileName) {
						continue;
					}
					const signal = findSignalByBindingRange(info.textSpan.start);
					if (!signal) {
						continue;
					}
					const oldSize = nodes.length;
					if (signal.binding) {
						for (const accessType of signal.binding.accessTypes) {
							if (ts.isPropertyAccessExpression(node.ast)) {
								if (accessType === ReactiveAccessType.ValueProperty && node.ast.name.text === 'value') {
									nodes.push(signal.binding);
									hasDependency ||= signal.isDependency;
								}
								if (accessType === ReactiveAccessType.AnyProperty && node.ast.name.text !== '') {
									nodes.push(signal.binding);
									hasDependency ||= signal.isDependency;
								}
							}
							else if (ts.isElementAccessExpression(node.ast)) {
								if (accessType === ReactiveAccessType.AnyProperty) {
									nodes.push(signal.binding);
									hasDependency ||= signal.isDependency;
								}
							}
							else if (ts.isCallExpression(node.ast)) {
								if (accessType === ReactiveAccessType.Call) {
									nodes.push(signal.binding);
									hasDependency ||= signal.isDependency;
								}
							}
						}
					}
					const signalDetected = nodes.length > oldSize;
					if (signalDetected) {
						if (signal.callback) {
							nodes.push(signal.callback);
						}
						const deps = findDependencies(signal, visited);
						nodes.push(...deps);
						hasDependency ||= deps.length > 0;
					}
				}
			}
			node.ast.forEachChild(child => {
				const childRange = toSourceNode(child);
				if (childRange) {
					visit(
						childRange,
						requiredAccess,
						ts.isPropertyAccessExpression(node.ast) || ts.isElementAccessExpression(node.ast),
					);
				}
			});
		}
	}

	function findDependents(node: ts.Node, trackKinds: ReactiveAccessType[], visited = new Set<number>()) {
		return collectBindingRanges(ts, node, sourceFile)
			.map(range => {
				const sourceRange = toSourceRange(range.start, range.end);
				if (sourceRange) {
					return findDependentsWorker(sourceRange.start, trackKinds, visited);
				}
				return [];
			})
			.flat();
	}

	function findDependentsWorker(pos: number, accessTypes: ReactiveAccessType[], visited = new Set<number>()) {
		if (visited.has(pos)) {
			return [];
		}
		visited.add(pos);

		const references = languageService.findReferences(sourceFile.fileName, pos);
		if (!references) {
			return [];
		}
		const result: typeof signals = [];
		for (const reference of references) {
			for (const reference2 of reference.references) {
				if (reference2.fileName !== sourceFile.fileName) {
					continue;
				}
				const effect = findSignalByAccessorRange(reference2.textSpan.start);
				if (effect?.accessor) {
					let match = false;
					if (effect.accessor.requiredAccess) {
						for (const accessType of accessTypes) {
							if (accessType === ReactiveAccessType.AnyProperty) {
								match ||= allPropertyAccess.has(reference2.textSpan.start + reference2.textSpan.length);
							}
							else if (accessType === ReactiveAccessType.ValueProperty) {
								match ||= allValuePropertyAccess.has(reference2.textSpan.start + reference2.textSpan.length);
							}
							else {
								match ||= allFunctionCalls.has(reference2.textSpan.start + reference2.textSpan.length);
							}
						}
					}
					if (match) {
						let hasDependent = effect.isDependent;
						if (effect.binding) {
							const dependents = findDependents(effect.binding.ast, effect.binding.accessTypes, visited);
							result.push(...dependents);
							hasDependent ||= dependents.length > 0;
						}
						if (hasDependent) {
							result.push(effect);
						}
					}
				}
			}
		}
		return result;
	}

	function findSignalByBindingRange(position: number): ReactiveNode | undefined {
		return signals.find(ref =>
			ref.binding && ref.binding.start <= position
			&& ref.binding.end >= position
		);
	}

	function findSignalByCallbackRange(position: number): ReactiveNode | undefined {
		return signals.filter(ref =>
			ref.callback && ref.callback.start <= position
			&& ref.callback.end >= position
		).sort((a, b) => (a.callback!.end - a.callback!.start) - (b.callback!.end - b.callback!.start))[0];
	}

	function findSignalByAccessorRange(position: number): ReactiveNode | undefined {
		return signals.filter(ref =>
			ref.accessor && ref.accessor.start <= position
			&& ref.accessor.end >= position
		).sort((a, b) => (a.accessor!.end - a.accessor!.start) - (b.accessor!.end - b.accessor!.start))[0];
	}
}

function analyze(
	ts: typeof import('typescript'),
	sourceFile: ts.SourceFile,
	toSourceRange: (start: number, end: number) => { start: number; end: number } | undefined,
	toSourceNode: (node: ts.Node) => { ast: ts.Node; start: number; end: number } | undefined,
) {
	const signals: ReactiveNode[] = [];
	const allValuePropertyAccess = new Set<number>();
	const allPropertyAccess = new Set<number>();
	const allFunctionCalls = new Set<number>();

	sourceFile.forEachChild(function visit(node) {
		if (ts.isVariableDeclaration(node)) {
			if (node.initializer && ts.isCallExpression(node.initializer)) {
				const call = node.initializer;
				if (ts.isIdentifier(call.expression)) {
					const callName = call.expression.escapedText as string;
					if (
						callName === 'ref' || callName === 'shallowRef' || callName === 'toRef' || callName === 'useTemplateRef'
						|| callName === 'defineModel'
					) {
						const nameRange = toSourceNode(node.name);
						if (nameRange) {
							signals.push({
								isDependency: true,
								isDependent: false,
								binding: {
									...nameRange,
									accessTypes: [ReactiveAccessType.ValueProperty],
								},
							});
						}
					}
					else if (
						callName === 'reactive' || callName === 'shallowReactive' || callName === 'defineProps'
						|| callName === 'withDefaults'
					) {
						const nameRange = toSourceNode(node.name);
						if (nameRange) {
							signals.push({
								isDependency: true,
								isDependent: false,
								binding: {
									...nameRange,
									accessTypes: [ReactiveAccessType.AnyProperty],
								},
							});
						}
					}
					// TODO: toRefs
				}
			}
		}
		else if (ts.isFunctionDeclaration(node)) {
			if (node.name && node.body) {
				const nameRange = toSourceNode(node.name);
				const bodyRange = toSourceNode(node.body);
				if (nameRange && bodyRange) {
					signals.push({
						isDependency: false,
						isDependent: false,
						binding: {
							...nameRange,
							accessTypes: [ReactiveAccessType.Call],
						},
						accessor: {
							...bodyRange,
							requiredAccess: true,
						},
						callback: bodyRange,
					});
				}
			}
		}
		else if (ts.isVariableStatement(node)) {
			for (const declaration of node.declarationList.declarations) {
				const name = declaration.name;
				const callback = declaration.initializer;
				if (
					callback && ts.isIdentifier(name) && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
				) {
					const nameRange = toSourceNode(name);
					const callbackRange = toSourceNode(callback);
					if (nameRange && callbackRange) {
						signals.push({
							isDependency: false,
							isDependent: false,
							binding: {
								...nameRange,
								accessTypes: [ReactiveAccessType.Call],
							},
							accessor: {
								...callbackRange,
								requiredAccess: true,
							},
							callback: callbackRange,
						});
					}
				}
			}
		}
		else if (ts.isParameter(node)) {
			if (node.type && ts.isTypeReferenceNode(node.type)) {
				const typeName = node.type.typeName.getText(sourceFile);
				if (typeName.endsWith('Ref')) {
					const nameRange = toSourceNode(node.name);
					if (nameRange) {
						signals.push({
							isDependency: true,
							isDependent: false,
							binding: {
								...nameRange,
								accessTypes: [ReactiveAccessType.ValueProperty],
							},
						});
					}
				}
			}
		}
		else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			const call = node;
			const callName = node.expression.escapedText as string;
			if ((callName === 'effect' || callName === 'watchEffect') && call.arguments.length) {
				const callback = call.arguments[0]!;
				if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
					const bodyRange = toSourceNode(callback.body);
					if (bodyRange) {
						signals.push({
							isDependency: false,
							isDependent: true,
							accessor: {
								...bodyRange,
								requiredAccess: true,
							},
							callback: bodyRange,
						});
					}
				}
			}
			if (callName === 'watch' && call.arguments.length >= 2) {
				const depsCallback = call.arguments[0]!;
				const effectCallback = call.arguments[1]!;
				if (ts.isArrowFunction(effectCallback) || ts.isFunctionExpression(effectCallback)) {
					if (ts.isArrowFunction(depsCallback) || ts.isFunctionExpression(depsCallback)) {
						const depsBodyRange = toSourceNode(depsCallback.body);
						const effectBodyRange = toSourceNode(effectCallback.body);
						if (depsBodyRange && effectBodyRange) {
							signals.push({
								isDependency: false,
								isDependent: true,
								accessor: {
									...depsBodyRange,
									requiredAccess: true,
								},
								callback: effectBodyRange,
							});
						}
					}
					else {
						const depsRange = toSourceNode(depsCallback);
						const effectBodyRange = toSourceNode(effectCallback.body);
						if (depsRange && effectBodyRange) {
							signals.push({
								isDependency: false,
								isDependent: true,
								accessor: {
									...depsRange,
									requiredAccess: false,
								},
								callback: effectBodyRange,
							});
						}
					}
				}
			}
			else if (hyphenateAttr(callName).startsWith('use-')) {
				let binding: ReactiveNode['binding'];
				if (ts.isVariableDeclaration(call.parent)) {
					const nameRange = toSourceNode(call.parent.name);
					if (nameRange) {
						binding = {
							...nameRange,
							accessTypes: [ReactiveAccessType.AnyProperty, ReactiveAccessType.Call],
						};
					}
				}
				const callRange = toSourceNode(call);
				if (callRange) {
					signals.push({
						isDependency: true,
						isDependent: false,
						binding,
						accessor: {
							...callRange,
							requiredAccess: false,
						},
					});
				}
			}
			else if ((callName === 'computed' || hyphenateAttr(callName).endsWith('-computed')) && call.arguments.length) {
				const arg = call.arguments[0]!;
				if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
					let binding: ReactiveNode['binding'];
					if (ts.isVariableDeclaration(call.parent)) {
						const nameRange = toSourceNode(call.parent.name);
						if (nameRange) {
							binding = {
								...nameRange,
								accessTypes: [ReactiveAccessType.ValueProperty],
							};
						}
					}
					const bodyRange = toSourceNode(arg.body);
					if (bodyRange) {
						signals.push({
							isDependency: true,
							isDependent: true,
							binding,
							accessor: {
								...bodyRange,
								requiredAccess: true,
							},
							callback: bodyRange,
						});
					}
				}
				else if (ts.isIdentifier(arg)) {
					let binding: ReactiveNode['binding'];
					if (ts.isVariableDeclaration(call.parent)) {
						const nameRange = toSourceNode(call.parent.name);
						if (nameRange) {
							binding = {
								...nameRange,
								accessTypes: [ReactiveAccessType.ValueProperty],
							};
						}
					}
					const argRange = toSourceNode(arg);
					if (argRange) {
						signals.push({
							isDependency: true,
							isDependent: false,
							binding,
							accessor: {
								...argRange,
								requiredAccess: false,
							},
						});
					}
				}
				else if (ts.isObjectLiteralExpression(arg)) {
					for (const prop of arg.properties) {
						if (prop.name?.getText(sourceFile) === 'get') {
							let binding: ReactiveNode['binding'];
							if (ts.isVariableDeclaration(call.parent)) {
								const nameRange = toSourceNode(call.parent.name);
								if (nameRange) {
									binding = {
										...nameRange,
										accessTypes: [ReactiveAccessType.ValueProperty],
									};
								}
							}
							if (ts.isPropertyAssignment(prop)) {
								const callback = prop.initializer;
								if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
									const bodyRange = toSourceNode(callback.body);
									if (bodyRange) {
										signals.push({
											isDependency: true,
											isDependent: true,
											binding,
											accessor: {
												...bodyRange,
												requiredAccess: true,
											},
											callback: bodyRange,
										});
									}
								}
							}
							else if (ts.isMethodDeclaration(prop) && prop.body) {
								const bodyRange = toSourceNode(prop.body);
								if (bodyRange) {
									signals.push({
										isDependency: true,
										isDependent: true,
										binding,
										accessor: {
											...bodyRange,
											requiredAccess: true,
										},
										callback: bodyRange,
									});
								}
							}
						}
					}
				}
			}
		}
		node.forEachChild(visit);
	});

	sourceFile.forEachChild(function visit(node) {
		if (ts.isPropertyAccessExpression(node)) {
			const sourceRange = toSourceRange(node.expression.end, node.expression.end);
			if (sourceRange) {
				if (node.name.text === 'value') {
					allValuePropertyAccess.add(sourceRange.end);
					allPropertyAccess.add(sourceRange.end);
				}
				else if (node.name.text !== '') {
					allPropertyAccess.add(sourceRange.end);
				}
			}
		}
		else if (ts.isElementAccessExpression(node)) {
			const sourceRange = toSourceRange(node.expression.end, node.expression.end);
			if (sourceRange) {
				allPropertyAccess.add(sourceRange.end);
			}
		}
		else if (ts.isCallExpression(node)) {
			const sourceRange = toSourceRange(node.expression.end, node.expression.end);
			if (sourceRange) {
				allFunctionCalls.add(sourceRange.end);
			}
		}
		node.forEachChild(visit);
	});

	return {
		signals,
		allValuePropertyAccess,
		allPropertyAccess,
		allFunctionCalls,
	};
}
