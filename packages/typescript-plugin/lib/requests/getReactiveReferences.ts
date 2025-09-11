import { collectBindingRanges, hyphenateAttr, type Language, type SourceScript } from '@vue/language-core';
import type * as ts from 'typescript';

const enum ReactiveAccessType {
	ValueProperty,
	AnyProperty,
	Call,
}

interface TsNode {
	ast: ts.Node;
	start: number;
	end: number;
}

interface ReactiveNode {
	binding?: TsNode & {
		isReactiveSource: boolean;
		accessTypes: ReactiveAccessType[];
	};
	accessor?: TsNode & {
		requiredAccess: boolean;
	};
	callback?: TsNode & {
		isReactiveEffect: boolean;
	};
}

const analyzeCache = new WeakMap<ts.SourceFile, ReturnType<typeof analyze>>();

export function getReactiveReferences(
	ts: typeof import('typescript'),
	language: Language,
	languageService: ts.LanguageService,
	sourceScript: SourceScript | undefined,
	fileName: string,
	position: number,
	leadingOffset: number,
) {
	const serviceScript = sourceScript?.generated?.languagePlugin.typescript?.getServiceScript(
		sourceScript.generated.root,
	);
	const map = serviceScript ? language.maps.get(serviceScript.code, sourceScript!) : undefined;
	const toSourceRange = map
		? (start: number, end: number) => {
			for (const [mappedStart, mappedEnd] of map.toSourceRange(start - leadingOffset, end - leadingOffset, false)) {
				return { start: mappedStart, end: mappedEnd };
			}
		}
		: (start: number, end: number) => ({ start, end });

	const sourceFile = languageService.getProgram()!.getSourceFile(fileName)!;

	if (!analyzeCache.has(sourceFile)) {
		analyzeCache.set(sourceFile, analyze(ts, sourceFile, toSourceRange));
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

	if (!info.callback?.isReactiveEffect && !dependents.length) {
		return;
	}
	if (!info.binding?.isReactiveSource && !dependencies.length) {
		return;
	}

	const dependencyRanges: { start: number; end: number }[] = [];
	const dependentRanges: { start: number; end: number }[] = [];

	for (const dependency of dependencies) {
		let { ast } = dependency;
		if (ts.isBlock(ast) && ast.statements.length) {
			const sourceRange = toSourceRange(
				ast.statements[0]!.getStart(sourceFile),
				ast.statements[ast.statements.length - 1]!.end,
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
			const sourceRange = toSourceRange(
				statements[0]!.getStart(sourceFile),
				statements[statements.length - 1]!.end,
			);
			if (sourceRange) {
				dependencyRanges.push({ start: sourceRange.start, end: sourceRange.end });
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

		const nodes: TsNode[] = [];
		let hasReactiveSource = !!signal.binding?.isReactiveSource;

		if (signal.accessor) {
			const { requiredAccess } = signal.accessor;
			visit(signal.accessor, requiredAccess);
			signal.accessor.ast.forEachChild(child => {
				const childRange = toSourceRange(child.getStart(sourceFile), child.end);
				if (childRange) {
					visit(
						{
							...childRange,
							ast: child,
						},
						requiredAccess,
					);
				}
			});
		}

		if (!hasReactiveSource) {
			return [];
		}

		return nodes;

		function visit(node: TsNode, requiredAccess: boolean, parentIsPropertyAccess = false) {
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
							hasReactiveSource ||= signal.binding.isReactiveSource;
						}
						if (signal.callback) {
							nodes.push(signal.callback);
						}
						const deps = findDependencies(signal, visited);
						nodes.push(...deps);
						hasReactiveSource ||= deps.length > 0;
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
									hasReactiveSource ||= signal.binding.isReactiveSource;
								}
								if (accessType === ReactiveAccessType.AnyProperty && node.ast.name.text !== '') {
									nodes.push(signal.binding);
									hasReactiveSource ||= signal.binding.isReactiveSource;
								}
							}
							else if (ts.isElementAccessExpression(node.ast)) {
								if (accessType === ReactiveAccessType.AnyProperty) {
									nodes.push(signal.binding);
									hasReactiveSource ||= signal.binding.isReactiveSource;
								}
							}
							else if (ts.isCallExpression(node.ast)) {
								if (accessType === ReactiveAccessType.Call) {
									nodes.push(signal.binding);
									hasReactiveSource ||= signal.binding.isReactiveSource;
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
						hasReactiveSource ||= deps.length > 0;
					}
				}
			}
			node.ast.forEachChild(child => {
				const childRange = toSourceRange(child.getStart(sourceFile), child.end);
				if (childRange) {
					visit(
						{
							...childRange,
							ast: child,
						},
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
					return findSubscribersWorker(sourceRange.start, trackKinds, visited);
				}
				return [];
			})
			.flat();
	}

	function findSubscribersWorker(pos: number, accessTypes: ReactiveAccessType[], visited = new Set<number>()) {
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
						let hasReactiveEffect = !!effect.callback?.isReactiveEffect;
						if (effect.binding) {
							const dependents = findDependents(effect.binding.ast, effect.binding.accessTypes, visited);
							result.push(...dependents);
							hasReactiveEffect ||= dependents.length > 0;
						}
						if (hasReactiveEffect) {
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
						const nameRange = toSourceRange(node.name.getStart(sourceFile), node.name.end);
						if (nameRange) {
							signals.push({
								binding: {
									...nameRange,
									ast: node.name,
									isReactiveSource: true,
									accessTypes: [ReactiveAccessType.ValueProperty],
								},
							});
						}
					}
					else if (
						callName === 'reactive' || callName === 'shallowReactive' || callName === 'defineProps'
						|| callName === 'withDefaults'
					) {
						const nameRange = toSourceRange(node.name.getStart(sourceFile), node.name.end);
						if (nameRange) {
							signals.push({
								binding: {
									...nameRange,
									ast: node.name,
									isReactiveSource: true,
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
				const nameRange = toSourceRange(node.name.getStart(sourceFile), node.name.end);
				const bodyRange = toSourceRange(node.body.getStart(sourceFile), node.body.end);
				if (nameRange && bodyRange) {
					signals.push({
						binding: {
							...nameRange,
							ast: node.name,
							isReactiveSource: false,
							accessTypes: [ReactiveAccessType.Call],
						},
						accessor: {
							...bodyRange,
							ast: node.body,
							requiredAccess: true,
						},
						callback: {
							...bodyRange,
							ast: node.body,
							isReactiveEffect: false,
						},
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
					const nameRange = toSourceRange(name.getStart(sourceFile), name.end);
					const callbackRange = toSourceRange(callback.getStart(sourceFile), callback.end);
					if (nameRange && callbackRange) {
						signals.push({
							binding: {
								...nameRange,
								ast: name,
								isReactiveSource: false,
								accessTypes: [ReactiveAccessType.Call],
							},
							accessor: {
								...callbackRange,
								ast: callback,
								requiredAccess: true,
							},
							callback: {
								...callbackRange,
								ast: callback,
								isReactiveEffect: false,
							},
						});
					}
				}
			}
		}
		else if (ts.isParameter(node)) {
			if (node.type && ts.isTypeReferenceNode(node.type)) {
				const typeName = node.type.typeName.getText(sourceFile);
				if (typeName.endsWith('Ref')) {
					const nameRange = toSourceRange(node.name.getStart(sourceFile), node.name.end);
					if (nameRange) {
						signals.push({
							binding: {
								...nameRange,
								ast: node.name,
								accessTypes: [ReactiveAccessType.ValueProperty],
								isReactiveSource: true,
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
					const callbackRange = toSourceRange(callback.getStart(sourceFile), callback.end);
					if (callbackRange) {
						signals.push({
							accessor: {
								...callbackRange,
								ast: callback.body,
								requiredAccess: true,
							},
							callback: {
								...callbackRange,
								ast: callback.body,
								isReactiveEffect: true,
							},
						});
					}
				}
			}
			if (callName === 'watch' && call.arguments.length >= 2) {
				const depsCallback = call.arguments[0]!;
				const effectCallback = call.arguments[1]!;
				if (ts.isArrowFunction(effectCallback) || ts.isFunctionExpression(effectCallback)) {
					const depsRange = toSourceRange(depsCallback.getStart(sourceFile), depsCallback.end);
					const effectRange = toSourceRange(effectCallback.getStart(sourceFile), effectCallback.end);
					if (depsRange && effectRange) {
						if (ts.isArrowFunction(depsCallback) || ts.isFunctionExpression(depsCallback)) {
							signals.push({
								accessor: {
									...depsRange,
									ast: depsCallback.body,
									requiredAccess: true,
								},
								callback: {
									...effectRange,
									ast: effectCallback.body,
									isReactiveEffect: true,
								},
							});
						}
						else {
							signals.push({
								accessor: {
									...depsRange,
									ast: depsCallback,
									requiredAccess: false,
								},
								callback: {
									...effectRange,
									ast: effectCallback.body,
									isReactiveEffect: true,
								},
							});
						}
					}
				}
			}
			else if (hyphenateAttr(callName).startsWith('use-')) {
				let binding: ReactiveNode['binding'];
				if (ts.isVariableDeclaration(call.parent)) {
					const nameRange = toSourceRange(call.parent.name.getStart(sourceFile), call.parent.name.end);
					if (nameRange) {
						binding = {
							...nameRange,
							ast: call.parent.name,
							isReactiveSource: true,
							accessTypes: [ReactiveAccessType.AnyProperty, ReactiveAccessType.Call],
						};
					}
				}
				const callRange = toSourceRange(call.getStart(sourceFile), call.end);
				if (callRange) {
					signals.push({
						binding,
						accessor: {
							...callRange,
							ast: call,
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
						const nameRange = toSourceRange(call.parent.name.getStart(sourceFile), call.parent.name.end);
						if (nameRange) {
							binding = {
								...nameRange,
								ast: call.parent.name,
								isReactiveSource: true,
								accessTypes: [ReactiveAccessType.ValueProperty],
							};
						}
					}
					const argRange = toSourceRange(arg.getStart(sourceFile), arg.end);
					if (argRange) {
						signals.push({
							binding,
							accessor: {
								...argRange,
								ast: arg.body,
								requiredAccess: true,
							},
							callback: {
								...argRange,
								ast: arg.body,
								isReactiveEffect: true,
							},
						});
					}
				}
				else if (ts.isIdentifier(arg)) {
					let binding: ReactiveNode['binding'];
					if (ts.isVariableDeclaration(call.parent)) {
						const nameRange = toSourceRange(call.parent.name.getStart(sourceFile), call.parent.name.end);
						if (nameRange) {
							binding = {
								...nameRange,
								ast: call.parent.name,
								isReactiveSource: true,
								accessTypes: [ReactiveAccessType.ValueProperty],
							};
						}
					}
					const argRange = toSourceRange(arg.getStart(sourceFile), arg.end);
					if (argRange) {
						signals.push({
							binding,
							accessor: {
								...argRange,
								ast: arg,
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
								const nameRange = toSourceRange(call.parent.name.getStart(sourceFile), call.parent.name.end);
								if (nameRange) {
									binding = {
										...nameRange,
										ast: call.parent.name,
										isReactiveSource: true,
										accessTypes: [ReactiveAccessType.ValueProperty],
									};
								}
							}
							if (ts.isPropertyAssignment(prop)) {
								const callback = prop.initializer;
								if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
									const callbackRange = toSourceRange(callback.getStart(sourceFile), callback.end);
									if (callbackRange) {
										signals.push({
											binding,
											accessor: {
												...callbackRange,
												ast: callback.body,
												requiredAccess: true,
											},
											callback: {
												...callbackRange,
												ast: callback.body,
												isReactiveEffect: true,
											},
										});
									}
								}
							}
							else if (ts.isMethodDeclaration(prop) && prop.body) {
								const bodyRange = toSourceRange(prop.body.getStart(sourceFile), prop.body.end);
								if (bodyRange) {
									signals.push({
										binding,
										accessor: {
											...bodyRange,
											ast: prop.body,
											requiredAccess: true,
										},
										callback: {
											...bodyRange,
											ast: prop.body,
											isReactiveEffect: true,
										},
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
