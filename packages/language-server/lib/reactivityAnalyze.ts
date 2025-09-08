import { collectBindingRanges, hyphenateAttr, type TextRange } from '@vue/language-core';
import type * as ts from 'typescript';

const enum TrackKind {
	AccessDotValue,
	AccessAnyValue,
	Call,
}

interface SignalNode {
	bindingInfo?: {
		isRef: boolean;
		name: ts.BindingName;
		trackKinds: TrackKind[];
	};
	trackInfo?: {
		depsHandler: ts.Node;
		needToUse: boolean;
	};
	sideEffectInfo?: {
		isEffect: boolean;
		handler: ts.Node;
	};
}

export function analyze(
	ts: typeof import('typescript'),
	languageService: ts.LanguageService,
	fileName: string,
	position: number,
) {
	const sourceFile = languageService.getProgram()!.getSourceFile(fileName)!;
	const { signals, dotValueAccesses, dotAnyAccesses, functionCalls } = collect(ts, sourceFile);
	let signal = findSignalByNamePosition(position);
	if (!signal) {
		signal = findEffectByEffectHandlerPosition(position);
		if (signal?.bindingInfo) {
			position = signal.bindingInfo.name.getStart(sourceFile);
		}
	}
	if (!signal) {
		return;
	}
	const dependencies = findDependencies(signal);
	const subscribers = signal.bindingInfo
		? findSubscribers(signal.bindingInfo.name, signal.bindingInfo.trackKinds)
		: [];

	if (
		(!signal.sideEffectInfo?.isEffect && !subscribers.length)
		|| (!signal.bindingInfo?.isRef && !dependencies.length)
	) {
		return;
	}

	return {
		sourceFile,
		subscribers: [...new Set(subscribers)],
		dependencies: [...new Set(dependencies)],
	};

	function findDependencies(signal: SignalNode, visited = new Set<SignalNode>()) {
		if (visited.has(signal)) {
			return [];
		}
		visited.add(signal);

		const nodes: ts.Node[] = [];
		let hasRef = signal.bindingInfo?.isRef ?? false;

		if (signal.trackInfo) {
			const { needToUse } = signal.trackInfo;
			visit(signal.trackInfo.depsHandler, needToUse);
			signal.trackInfo.depsHandler.forEachChild(child => visit(child, needToUse));
		}

		if (!hasRef) {
			return [];
		}

		return nodes;

		function visit(node: ts.Node, needToUse: boolean, parentIsPropertyAccess = false) {
			if (!needToUse) {
				if (!parentIsPropertyAccess && ts.isIdentifier(node)) {
					const definition = languageService.getDefinitionAtPosition(fileName, node.getStart(sourceFile));
					for (const info of definition ?? []) {
						if (info.fileName !== fileName) {
							continue;
						}
						const signal = findSignalByNamePosition(info.textSpan.start);
						if (!signal) {
							continue;
						}
						if (signal.bindingInfo) {
							nodes.push(signal.bindingInfo.name);
							hasRef ||= signal.bindingInfo.isRef;
						}
						if (signal.sideEffectInfo) {
							nodes.push(signal.sideEffectInfo.handler);
						}
						const deps = findDependencies(signal, visited);
						nodes.push(...deps);
						hasRef ||= deps.length > 0;
					}
				}
			}
			else if (
				ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node)
			) {
				const definition = languageService.getDefinitionAtPosition(fileName, node.expression.getStart(sourceFile));
				for (const info of definition ?? []) {
					if (info.fileName !== fileName) {
						continue;
					}
					const signal = findSignalByNamePosition(info.textSpan.start);
					if (!signal) {
						continue;
					}
					const oldSize = nodes.length;
					if (signal.bindingInfo) {
						for (const trackKind of signal.bindingInfo.trackKinds) {
							if (ts.isPropertyAccessExpression(node)) {
								if (trackKind === TrackKind.AccessDotValue && node.name.text === 'value') {
									nodes.push(signal.bindingInfo.name);
									hasRef ||= signal.bindingInfo.isRef;
								}
								if (trackKind === TrackKind.AccessAnyValue && node.name.text !== '') {
									nodes.push(signal.bindingInfo.name);
									hasRef ||= signal.bindingInfo.isRef;
								}
							}
							else if (ts.isElementAccessExpression(node)) {
								if (trackKind === TrackKind.AccessAnyValue) {
									nodes.push(signal.bindingInfo.name);
									hasRef ||= signal.bindingInfo.isRef;
								}
							}
							else if (ts.isCallExpression(node)) {
								if (trackKind === TrackKind.Call) {
									nodes.push(signal.bindingInfo.name);
									hasRef ||= signal.bindingInfo.isRef;
								}
							}
						}
					}
					const signalDetected = nodes.length > oldSize;
					if (signalDetected) {
						if (signal.sideEffectInfo) {
							nodes.push(signal.sideEffectInfo.handler);
						}
						const deps = findDependencies(signal, visited);
						nodes.push(...deps);
						hasRef ||= deps.length > 0;
					}
				}
			}
			node.forEachChild(child =>
				visit(child, needToUse, ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
			);
		}
	}

	function findSubscribers(refName: ts.BindingName, trackKinds: TrackKind[], visited = new Set<number>()) {
		return collectBindingRanges(ts, refName, sourceFile)
			.map(range => findSubscribersWorker(range, trackKinds, visited))
			.flat();
	}

	function findSubscribersWorker(refName: TextRange, trackKinds: TrackKind[], visited = new Set<number>()) {
		if (visited.has(refName.start)) {
			return [];
		}
		visited.add(refName.start);

		const references = languageService.findReferences(fileName, refName.start);
		if (!references) {
			return [];
		}
		const result: typeof signals = [];
		for (const reference of references) {
			for (const reference2 of reference.references) {
				if (reference2.fileName !== fileName) {
					continue;
				}
				const effect = findEffectByDepsHandlerPosition(reference2.textSpan.start);
				if (effect?.trackInfo) {
					if (effect.trackInfo.needToUse) {
						let match = false;
						for (const trackKind of trackKinds) {
							if (trackKind === TrackKind.AccessAnyValue) {
								match = dotAnyAccesses.has(reference2.textSpan.start + reference2.textSpan.length);
							}
							else if (trackKind === TrackKind.AccessDotValue) {
								match = dotValueAccesses.has(reference2.textSpan.start + reference2.textSpan.length);
							}
							else {
								match = functionCalls.has(reference2.textSpan.start + reference2.textSpan.length);
							}
							if (match) {
								break;
							}
						}
						if (!match) {
							continue;
						}
					}
					let hasEffect = effect.sideEffectInfo?.isEffect;
					if (effect.bindingInfo) {
						const subs = findSubscribers(effect.bindingInfo.name, effect.bindingInfo.trackKinds, visited);
						result.push(...subs);
						hasEffect ||= subs.length > 0;
					}
					if (hasEffect) {
						result.push(effect);
					}
				}
			}
		}
		return result;
	}

	function findSignalByNamePosition(position: number): SignalNode | undefined {
		return signals.find(ref =>
			ref.bindingInfo && ref.bindingInfo.name.getStart(sourceFile) <= position
			&& ref.bindingInfo.name.getEnd() >= position
		);
	}

	function findEffectByEffectHandlerPosition(position: number): SignalNode | undefined {
		return signals.filter(ref =>
			ref.sideEffectInfo && ref.sideEffectInfo.handler.getStart(sourceFile) <= position
			&& ref.sideEffectInfo.handler.getEnd() >= position
		).sort((a, b) =>
			a.sideEffectInfo!.handler.getWidth(sourceFile) - b.sideEffectInfo!.handler.getWidth(sourceFile)
		)[0];
	}

	function findEffectByDepsHandlerPosition(position: number): SignalNode | undefined {
		return signals.filter(ref =>
			ref.trackInfo && ref.trackInfo.depsHandler.getStart(sourceFile) <= position
			&& ref.trackInfo.depsHandler.getEnd() >= position
		).sort((a, b) => a.trackInfo!.depsHandler.getWidth(sourceFile) - b.trackInfo!.depsHandler.getWidth(sourceFile))[0];
	}
}

function collect(ts: typeof import('typescript'), sourceFile: ts.SourceFile) {
	const signals: SignalNode[] = [];
	const dotValueAccesses = new Set<number>();
	const dotAnyAccesses = new Set<number>();
	const functionCalls = new Set<number>();

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
						signals.push({
							bindingInfo: {
								isRef: true,
								name: node.name,
								trackKinds: [TrackKind.AccessDotValue],
							},
						});
					}
					else if (
						callName === 'reactive' || callName === 'shallowReactive' || callName === 'defineProps'
						|| callName === 'withDefaults'
					) {
						signals.push({
							bindingInfo: {
								isRef: true,
								name: node.name,
								trackKinds: [TrackKind.AccessAnyValue],
							},
						});
					}
					// TODO: toRefs
				}
			}
		}
		else if (ts.isFunctionDeclaration(node)) {
			if (node.name && node.body) {
				signals.push({
					bindingInfo: {
						isRef: false,
						name: node.name,
						trackKinds: [TrackKind.Call],
					},
					trackInfo: {
						depsHandler: node.body,
						needToUse: true,
					},
					sideEffectInfo: {
						isEffect: false,
						handler: node.body,
					},
				});
			}
		}
		else if (ts.isVariableStatement(node)) {
			for (const declaration of node.declarationList.declarations) {
				const name = declaration.name;
				const callback = declaration.initializer;
				if (callback && ts.isIdentifier(name) && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
					signals.push({
						bindingInfo: {
							isRef: false,
							name: name,
							trackKinds: [TrackKind.Call],
						},
						trackInfo: {
							depsHandler: callback,
							needToUse: true,
						},
						sideEffectInfo: {
							isEffect: false,
							handler: callback,
						},
					});
				}
			}
		}
		else if (ts.isParameter(node)) {
			if (node.type && ts.isTypeReferenceNode(node.type)) {
				const typeName = node.type.typeName.getText(sourceFile);
				if (typeName.endsWith('Ref')) {
					signals.push({
						bindingInfo: {
							isRef: true,
							name: node.name,
							trackKinds: [TrackKind.AccessDotValue],
						},
					});
				}
			}
		}
		else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			const call = node;
			const callName = node.expression.escapedText as string;
			if ((callName === 'effect' || callName === 'watchEffect') && call.arguments.length) {
				const callback = call.arguments[0]!;
				if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
					signals.push({
						trackInfo: {
							depsHandler: callback.body,
							needToUse: true,
						},
						sideEffectInfo: {
							isEffect: true,
							handler: callback.body,
						},
					});
				}
			}
			if (callName === 'watch' && call.arguments.length >= 2) {
				const depsCallback = call.arguments[0]!;
				const effectCallback = call.arguments[1]!;
				if (ts.isArrowFunction(effectCallback) || ts.isFunctionExpression(effectCallback)) {
					if (ts.isArrowFunction(depsCallback) || ts.isFunctionExpression(depsCallback)) {
						signals.push({
							trackInfo: {
								depsHandler: depsCallback.body,
								needToUse: true,
							},
							sideEffectInfo: {
								isEffect: true,
								handler: effectCallback.body,
							},
						});
					}
					else {
						signals.push({
							trackInfo: {
								depsHandler: depsCallback,
								needToUse: false,
							},
							sideEffectInfo: {
								isEffect: true,
								handler: effectCallback.body,
							},
						});
					}
				}
			}
			else if (hyphenateAttr(callName).startsWith('use-')) {
				signals.push({
					bindingInfo: ts.isVariableDeclaration(call.parent)
						? {
							isRef: true,
							name: call.parent.name,
							trackKinds: [TrackKind.AccessAnyValue, TrackKind.Call],
						}
						: undefined,
					trackInfo: {
						depsHandler: call,
						needToUse: false,
					},
				});
			}
			else if ((callName === 'computed' || hyphenateAttr(callName).endsWith('-computed')) && call.arguments.length) {
				const arg = call.arguments[0]!;
				if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
					signals.push({
						bindingInfo: ts.isVariableDeclaration(call.parent)
							? {
								isRef: true,
								name: call.parent.name,
								trackKinds: [TrackKind.AccessDotValue],
							}
							: undefined,
						trackInfo: {
							depsHandler: arg.body,
							needToUse: true,
						},
						sideEffectInfo: {
							isEffect: true,
							handler: arg.body,
						},
					});
				}
				else if (ts.isIdentifier(arg)) {
					signals.push({
						bindingInfo: ts.isVariableDeclaration(call.parent)
							? {
								isRef: true,
								name: call.parent.name,
								trackKinds: [TrackKind.AccessDotValue],
							}
							: undefined,
						trackInfo: {
							depsHandler: arg,
							needToUse: false,
						},
					});
				}
				else if (ts.isObjectLiteralExpression(arg)) {
					for (const prop of arg.properties) {
						if (prop.name?.getText(sourceFile) === 'get') {
							if (ts.isPropertyAssignment(prop)) {
								const callback = prop.initializer;
								if (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) {
									signals.push({
										bindingInfo: ts.isVariableDeclaration(call.parent)
											? {
												isRef: true,
												name: call.parent.name,
												trackKinds: [TrackKind.AccessDotValue],
											}
											: undefined,
										trackInfo: {
											depsHandler: callback.body,
											needToUse: true,
										},
										sideEffectInfo: {
											isEffect: true,
											handler: callback.body,
										},
									});
								}
							}
							else if (ts.isMethodDeclaration(prop) && prop.body) {
								signals.push({
									bindingInfo: ts.isVariableDeclaration(call.parent)
										? {
											isRef: true,
											name: call.parent.name,
											trackKinds: [TrackKind.AccessDotValue],
										}
										: undefined,
									trackInfo: {
										depsHandler: prop.body,
										needToUse: true,
									},
									sideEffectInfo: {
										isEffect: true,
										handler: prop.body,
									},
								});
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
			if (node.name.text === 'value') {
				dotValueAccesses.add(node.expression.getEnd());
				dotAnyAccesses.add(node.expression.getEnd());
			}
			else if (node.name.text !== '') {
				dotAnyAccesses.add(node.expression.getEnd());
			}
		}
		else if (ts.isElementAccessExpression(node)) {
			dotAnyAccesses.add(node.expression.getEnd());
		}
		else if (ts.isCallExpression(node)) {
			functionCalls.add(node.expression.getEnd());
		}
		node.forEachChild(visit);
	});

	return {
		signals,
		dotValueAccesses,
		dotAnyAccesses,
		functionCalls,
	};
}
