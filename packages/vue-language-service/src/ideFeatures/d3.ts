// import type { LanguageServiceRuntimeContext } from '../types';
// import * as vscode from 'vscode-languageserver-protocol';
// import type { TextDocument } from 'vscode-languageserver-textdocument';
// import * as references from '../languageFeatures/references';
// import * as definitions from '../languageFeatures/definition';
// import type * as ts from 'typescript/lib/tsserverlibrary';
// import * as shared from '@volar/shared';
// import * as SourceMaps from '@volar/source-map';

// export function register(context: LanguageServiceRuntimeContext) {

// 	const findReferences = references.register(arguments[0]);
// 	const findDefinition = definitions.register(arguments[0], 'findDefinition', data => !!data.capabilities.definitions, data => !!data.capabilities.definitions);

// 	return async (document: TextDocument) => {

// 		const usedNames = new Set<string>();
// 		const usedNamesMap = new Map<number, string>();
// 		const refs: {
// 			type: 'ref',
// 			name: string,
// 			range: SourceMaps.Range,
// 			blockRange: SourceMaps.Range,
// 			references: vscode.Location[], // refCalls
// 		}[] = [];
// 		const funcs: {
// 			type: 'func',
// 			name: string,
// 			range: SourceMaps.Range,
// 			blockRange: SourceMaps.Range,
// 		}[] = [];
// 		const funcCalls: {
// 			name: string,
// 			range: SourceMaps.Range,
// 			definitions: (vscode.Location | vscode.LocationLink)[],
// 		}[] = [];

// 		const vueDocument = context.vueDocuments.get(document.uri);
// 		const tsDoc = context.templateTsLs?.__internal__.getTextDocument(document.uri);

// 		if (vueDocument) {

// 			const template = vueDocument.vueFile.sfc.template;
// 			if (template) {
// 				funcs.push({
// 					type: 'func',
// 					name: '__template__',
// 					range: {
// 						start: template.startTagEnd,
// 						end: template.startTagEnd,
// 					},
// 					blockRange: {
// 						start: template.startTagEnd,
// 						end: template.startTagEnd + template.content.length,
// 					},
// 				});
// 			}

// 			for (const embedded of vueDocument.vueFile.getAllEmbeddeds()) {

// 				if (embedded.file.lsType === 'nonTs')
// 					continue;

// 				const virtualCode = embedded.file.content;
// 				const scriptAst = context.typescript.createSourceFile('foo.' + embedded.file.lang, virtualCode, context.typescript.ScriptTarget.Latest);

// 				await nodeWalker(scriptAst);

// 				async function nodeWalker(node: ts.Node) {
// 					if (
// 						context.typescript.isVariableDeclaration(node)
// 						&& context.typescript.isIdentifier(node.name)
// 						&& node.initializer
// 						&& context.typescript.isCallExpression(node.initializer)
// 						&& isRef(node.initializer, scriptAst)
// 					) {
// 						const range = embedded.sourceMap.getSourceRange(
// 							node.name.getStart(scriptAst),
// 							node.name.getStart(scriptAst) + node.name.getWidth(scriptAst),
// 						)?.[0];
// 						const _argRange = getArgRanges(node.initializer, scriptAst);
// 						const argsStartRange = _argRange ? embedded.sourceMap.getSourceRange(
// 							_argRange.start,
// 							_argRange.start,
// 						)?.[0] : undefined;
// 						const argsEndRange = _argRange ? embedded.sourceMap.getSourceRange(
// 							_argRange.end,
// 							_argRange.end,
// 						)?.[0] : undefined;
// 						if (range && argsStartRange && argsEndRange) {
// 							refs.push({
// 								type: 'ref',
// 								name: getNodeName(range),
// 								range: range,
// 								blockRange: {
// 									start: argsStartRange.start,
// 									end: argsEndRange.start,
// 								},
// 								references: await findReferences(embedded.sourceDocument.uri, range.start) ?? [],
// 							});
// 						}
// 						for (const arg of node.initializer.arguments) {
// 							arg.forEachChild(child => nodeWalker(child));
// 						}
// 					}
// 					else if (
// 						ts.isFunctionDeclaration(node)
// 						&& node.name
// 						&& node.body
// 					) {
// 						const range = embedded.getSourceRange(
// 							embedded.mappedDocument.positionAt(node.name.getStart(scriptAst)),
// 							embedded.mappedDocument.positionAt(node.name.getStart(scriptAst) + node.name.getWidth(scriptAst)),
// 						)?.[0];
// 						const blockStartRange = embedded.getSourceRange(
// 							embedded.mappedDocument.positionAt(node.body.getStart(scriptAst)),
// 							embedded.mappedDocument.positionAt(node.body.getStart(scriptAst)),
// 						)?.[0];
// 						const blockEndRange = embedded.getSourceRange(
// 							embedded.mappedDocument.positionAt(node.body.getStart(scriptAst) + node.body.getWidth(scriptAst)),
// 							embedded.mappedDocument.positionAt(node.body.getStart(scriptAst) + node.body.getWidth(scriptAst)),
// 						)?.[0];
// 						if (range && blockStartRange && blockEndRange) {
// 							funcs.push({
// 								type: 'func',
// 								name: getNodeName(range),
// 								range: range,
// 								blockRange: {
// 									start: blockStartRange.start,
// 									end: blockEndRange.start,
// 								},
// 							});
// 						}
// 						node.forEachChild(child => nodeWalker(child));
// 					}
// 					else if (
// 						ts.isVariableDeclaration(node)
// 						&& node.name
// 						&& node.initializer
// 						&& ts.isIdentifier(node.name)
// 						&& ts.isArrowFunction(node.initializer)
// 					) {
// 						const nameRange = embedded.getSourceRange(
// 							embedded.mappedDocument.positionAt(node.name.getStart(scriptAst)),
// 							embedded.mappedDocument.positionAt(node.name.getStart(scriptAst) + node.name.getWidth(scriptAst)),
// 						)?.[0];
// 						const startRange = embedded.getSourceRange(
// 							embedded.mappedDocument.positionAt(node.initializer.getStart(scriptAst)),
// 							embedded.mappedDocument.positionAt(node.initializer.getStart(scriptAst)),
// 						)?.[0];
// 						const endRange = embedded.getSourceRange(
// 							embedded.mappedDocument.positionAt(node.initializer.getStart(scriptAst) + node.initializer.getWidth(scriptAst)),
// 							embedded.mappedDocument.positionAt(node.initializer.getStart(scriptAst) + node.initializer.getWidth(scriptAst)),
// 						)?.[0];
// 						const blockStartRange = embedded.getSourceRange(
// 							embedded.mappedDocument.positionAt(node.initializer.body.getStart(scriptAst)),
// 							embedded.mappedDocument.positionAt(node.initializer.body.getStart(scriptAst)),
// 						)?.[0];
// 						const blockEndRange = embedded.getSourceRange(
// 							embedded.mappedDocument.positionAt(node.initializer.body.getStart(scriptAst) + node.initializer.body.getWidth(scriptAst)),
// 							embedded.mappedDocument.positionAt(node.initializer.body.getStart(scriptAst) + node.initializer.body.getWidth(scriptAst)),
// 						)?.[0];
// 						if (nameRange && startRange && endRange && blockStartRange && blockEndRange) {
// 							funcs.push({
// 								type: 'func',
// 								name: getNodeName(nameRange),
// 								range: {
// 									start: startRange.start,
// 									end: endRange.start,
// 								},
// 								blockRange: {
// 									start: blockStartRange.start,
// 									end: blockEndRange.start,
// 								},
// 							});
// 						}
// 						node.forEachChild(child => nodeWalker(child));
// 					}
// 					else if (ts.isCallExpression(node)) {
// 						const name = getCallName(node);
// 						if (name) {
// 							const range = embedded.getSourceRange(
// 								embedded.mappedDocument.positionAt(name.getStart(scriptAst)),
// 								embedded.mappedDocument.positionAt(name.getStart(scriptAst) + name.getWidth(scriptAst)),
// 							)?.[0];
// 							const _argRange = getArgRanges(node, scriptAst);
// 							const argsRange = _argRange ? embedded.getSourceRange(
// 								embedded.mappedDocument.positionAt(_argRange.start),
// 								embedded.mappedDocument.positionAt(_argRange.end),
// 							) : undefined;
// 							if (range && argsRange) {
// 								funcCalls.push({
// 									name: embedded.sourceDocument.getText(range),
// 									range: range,
// 									definitions: await findDefinition(embedded.sourceDocument.uri, range.start) ?? [],
// 								});
// 							}
// 						}
// 						node.forEachChild(child => nodeWalker(child));
// 					}
// 					else {
// 						node.forEachChild(child => nodeWalker(child));
// 					}
// 				}
// 			}
// 		}
// 		else if (tsDoc) {
// 			// TODO: extract to function
// 			const virtualCode = tsDoc.getText();
// 			const scriptAst = ts.createSourceFile('foo.' + shared.languageIdToSyntax(tsDoc.languageId), virtualCode, ts.ScriptTarget.Latest);

// 			await nodeWalker(scriptAst, tsDoc);

// 			async function nodeWalker(node: ts.Node, tsDoc: TextDocument) {
// 				if (
// 					ts.isVariableDeclaration(node)
// 					&& ts.isIdentifier(node.name)
// 					&& node.initializer
// 					&& ts.isCallExpression(node.initializer)
// 					&& isRef(node.initializer, scriptAst)
// 				) {
// 					const loc = {
// 						start: tsDoc.positionAt(node.name.getStart(scriptAst)),
// 						end: tsDoc.positionAt(node.name.getStart(scriptAst) + node.name.getWidth(scriptAst)),
// 					};
// 					const _argRange = getArgRanges(node.initializer, scriptAst);
// 					const argsStartLoc = _argRange ? {
// 						start: tsDoc.positionAt(_argRange.start),
// 						end: tsDoc.positionAt(_argRange.start),
// 					} : undefined;
// 					const argsEndLoc = _argRange ? {
// 						start: tsDoc.positionAt(_argRange.end),
// 						end: tsDoc.positionAt(_argRange.end),
// 					} : undefined;
// 					if (loc && argsStartLoc && argsEndLoc) {
// 						refs.push({
// 							type: 'ref',
// 							name: _getNodeName(tsDoc.getText(loc)),
// 							range: loc,
// 							blockRange: {
// 								start: argsStartLoc.start,
// 								end: argsEndLoc.start,
// 							},
// 							references: await findReferences(tsDoc.uri, loc.start) ?? [],
// 						});
// 					}
// 					for (const arg of node.initializer.arguments) {
// 						arg.forEachChild(child => nodeWalker(child, tsDoc));
// 					}
// 				}
// 				else if (
// 					ts.isFunctionDeclaration(node)
// 					&& node.name
// 					&& node.body
// 				) {
// 					const loc = {
// 						start: tsDoc.positionAt(node.name.getStart(scriptAst)),
// 						end: tsDoc.positionAt(node.name.getStart(scriptAst) + node.name.getWidth(scriptAst)),
// 					};
// 					const blockStartLoc = {
// 						start: tsDoc.positionAt(node.body.getStart(scriptAst)),
// 						end: tsDoc.positionAt(node.body.getStart(scriptAst)),
// 					};
// 					const blockEndLoc = {
// 						start: tsDoc.positionAt(node.body.getStart(scriptAst) + node.body.getWidth(scriptAst)),
// 						end: tsDoc.positionAt(node.body.getStart(scriptAst) + node.body.getWidth(scriptAst)),
// 					};
// 					if (loc && blockStartLoc && blockEndLoc) {
// 						funcs.push({
// 							type: 'func',
// 							name: _getNodeName(tsDoc.getText(loc)),
// 							range: loc,
// 							blockRange: {
// 								start: blockStartLoc.start,
// 								end: blockEndLoc.start,
// 							},
// 						});
// 					}
// 					node.forEachChild(child => nodeWalker(child, tsDoc));
// 				}
// 				else if (
// 					ts.isVariableDeclaration(node)
// 					&& node.name
// 					&& node.initializer
// 					&& ts.isIdentifier(node.name)
// 					&& ts.isArrowFunction(node.initializer)
// 				) {
// 					const startLoc = {
// 						start: tsDoc.positionAt(node.initializer.getStart(scriptAst)),
// 						end: tsDoc.positionAt(node.initializer.getStart(scriptAst)),
// 					};
// 					const endLoc = {
// 						start: tsDoc.positionAt(node.initializer.getStart(scriptAst) + node.initializer.getWidth(scriptAst)),
// 						end: tsDoc.positionAt(node.initializer.getStart(scriptAst) + node.initializer.getWidth(scriptAst)),
// 					};
// 					const blockStartLoc = {
// 						start: tsDoc.positionAt(node.initializer.body.getStart(scriptAst)),
// 						end: tsDoc.positionAt(node.initializer.body.getStart(scriptAst)),
// 					};
// 					const blockEndLoc = {
// 						start: tsDoc.positionAt(node.initializer.body.getStart(scriptAst) + node.initializer.body.getWidth(scriptAst)),
// 						end: tsDoc.positionAt(node.initializer.body.getStart(scriptAst) + node.initializer.body.getWidth(scriptAst)),
// 					};
// 					if (startLoc && endLoc && blockStartLoc && blockEndLoc) {
// 						funcs.push({
// 							type: 'func',
// 							name: _getNodeName(node.name.getText(scriptAst)),
// 							range: {
// 								start: startLoc.start,
// 								end: endLoc.start,
// 							},
// 							blockRange: {
// 								start: blockStartLoc.start,
// 								end: blockEndLoc.start,
// 							},
// 						});
// 					}
// 					node.forEachChild(child => nodeWalker(child, tsDoc));
// 				}
// 				else if (ts.isCallExpression(node)) {
// 					const name = getCallName(node);
// 					if (name) {
// 						const loc = {
// 							start: tsDoc.positionAt(name.getStart(scriptAst)),
// 							end: tsDoc.positionAt(name.getStart(scriptAst) + name.getWidth(scriptAst)),
// 						};
// 						const _argRange = getArgRanges(node, scriptAst);
// 						const argsLoc = _argRange ? {
// 							start: tsDoc.positionAt(_argRange.start),
// 							end: tsDoc.positionAt(_argRange.end),
// 						} : undefined;
// 						if (loc && argsLoc) {
// 							funcCalls.push({
// 								name: tsDoc.getText(loc),
// 								range: loc,
// 								definitions: await findDefinition(tsDoc.uri, loc.start) ?? [],
// 							});
// 						}
// 					}
// 					node.forEachChild(child => nodeWalker(child, tsDoc));
// 				}
// 				else {
// 					node.forEachChild(child => nodeWalker(child, tsDoc));
// 				}
// 			}
// 		}

// 		const refsLinks = new Map<string, Set<string>>();
// 		const funcsLinks = new Map<string, Set<string>>();
// 		const fileLinks = new Map<string, Set<string>>();

// 		for (const ref of refs) {
// 			refsLinks.set(ref.name, new Set());
// 		}
// 		for (const func of funcs) {
// 			funcsLinks.set(func.name, new Set());
// 		}
// 		for (const ref of refs) {
// 			for (const reference of ref.references) {
// 				if (reference.uri === document.uri) {
// 					const match = findBestMatchBlock(reference.range);
// 					if (match) {
// 						if (match.type === 'ref') {
// 							refsLinks.get(match.name)?.add(ref.name);
// 						}
// 						else if (match.type === 'func') {
// 							funcsLinks.get(match.name)?.add(ref.name);
// 						}
// 					}
// 				}
// 				else {
// 					// TODO
// 					// const fileName = upath.basename(reference.uri).replace(/\./g, '_');
// 					const fileName = '__out_of_file__';
// 					if (!fileLinks.has(fileName)) {
// 						fileLinks.set(fileName, new Set());
// 					}
// 					fileLinks.get(fileName)?.add(ref.name);
// 				}
// 			}
// 		}
// 		for (const funcCall of funcCalls) {
// 			for (const definition of funcCall.definitions) {
// 				const uri = vscode.Location.is(definition) ? definition.uri : definition.targetUri;
// 				const range = vscode.Location.is(definition) ? definition.range : definition.targetSelectionRange;
// 				if (uri === document.uri) {
// 					const definitionFunc = funcs.find(func =>
// 						range.start.line === func.range.start.line
// 						&& range.start.character === func.range.start.character
// 						&& range.end.line === func.range.end.line
// 						&& range.end.character === func.range.end.character
// 					);
// 					const match = findBestMatchBlock(funcCall.range);
// 					if (definitionFunc && match) {
// 						if (match.type === 'ref') {
// 							refsLinks.get(match.name)?.add(definitionFunc.name);
// 						}
// 						else if (match.type === 'func') {
// 							funcsLinks.get(match.name)?.add(definitionFunc.name);
// 						}
// 					}
// 				}
// 				else {
// 					// TODO
// 					// const fileName = upath.basename(definition.uri).replace(/\./g, '_');
// 					const fileName = '__out_of_file__';
// 					const match = findBestMatchBlock(funcCall.range);
// 					if (match) {
// 						if (match.type === 'ref') {
// 							refsLinks.get(match.name)?.add(fileName);
// 						}
// 						else if (match.type === 'func') {
// 							funcsLinks.get(match.name)?.add(fileName);
// 						}
// 					}
// 				}
// 			}
// 		}
// 		let outStr = `digraph  {`;
// 		for (const [source, targets] of refsLinks) {
// 			outStr += `    ${source} [shape="box"]`;
// 			for (const target of targets) {
// 				outStr += `    ${source} -> ${target}`;
// 			}
// 		}
// 		for (const [source, targets] of funcsLinks) {
// 			for (const target of targets) {
// 				outStr += `    ${source} -> ${target}`;
// 			}
// 		}
// 		for (const [source, targets] of fileLinks) {
// 			for (const target of targets) {
// 				outStr += `    ${source} -> ${target}`;
// 			}
// 		}
// 		outStr += `}`;
// 		return outStr;

// 		function getCallName(call: ts.CallExpression) {
// 			if (context.typescript.isIdentifier(call.expression)) {
// 				return call.expression
// 			}
// 			else if (context.typescript.isPropertyAccessExpression(call.expression)) {
// 				return call.expression.name
// 			}
// 		}
// 		function isRef(call: ts.CallExpression, scriptAst: ts.SourceFile) {
// 			const name = getCallName(call);
// 			if (!name) return false;
// 			return name.getText(scriptAst) === 'ref' || name.getText(scriptAst) === 'computed' || name.getText(scriptAst) === 'reactive'; // TODO
// 		}
// 		function getArgRanges(call: ts.CallExpression, scriptAst: ts.SourceFile) {
// 			if (!call.arguments.length) return;
// 			const startArg = call.arguments[0];
// 			const endArg = call.arguments[call.arguments.length - 1];
// 			return {
// 				start: startArg.getStart(scriptAst),
// 				end: endArg.getStart(scriptAst) + endArg.getWidth(scriptAst),
// 			};
// 		}
// 		function _getNodeName(name: string) {
// 			if (!usedNames.has(name)) {
// 				usedNames.add(name);
// 				return name;
// 			}
// 			let i = 1;
// 			let newName = `${name}_${i}`;
// 			while (usedNames.has(newName)) {
// 				i++;
// 				newName = `${name}_${i}`;
// 			}
// 			usedNames.add(newName);
// 			return newName;
// 		}
// 		function getNodeName(range: SourceMaps.Range) {
// 			if (usedNamesMap.has(range.start)) {
// 				return usedNamesMap.get(range.start)!;
// 			}
// 			const name = _getNodeName(document.getText().substring(range.start, range.end));
// 			usedNamesMap.set(range.start, name);
// 			return name;
// 		}
// 		function findBestMatchBlock(range: SourceMaps.Range) {
// 			const _refs = refs.filter(ref =>
// 				range.start >= ref.blockRange.start
// 				&& range.end <= ref.blockRange.end
// 			);
// 			const _funcs = funcs.filter(func =>
// 				range.start >= func.blockRange.start
// 				&& range.end <= func.blockRange.end
// 			);
// 			const _arr = [..._refs, ..._funcs];
// 			if (!_arr.length) return;
// 			return _arr.sort((a, b) =>
// 				(a.blockRange.end - a.blockRange.start)
// 				- (b.blockRange.end - b.blockRange.start)
// 			)[0];
// 		}
// 	}
// }
