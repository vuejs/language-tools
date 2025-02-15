import { defineConfig } from '@tsslint/config';
import { convertConfig } from '@tsslint/eslint';
import * as path from 'node:path';
import type * as ts from 'typescript';

export default defineConfig({
	rules: {
		semantic: {
			...convertConfig({
				'@typescript-eslint/no-unnecessary-type-assertion': 'warn',
			}),
		},
		workspace: {
			'missing-dependency'({ typescript: ts, sourceFile, reportError, languageServiceHost }) {
				const { noEmit } = languageServiceHost.getCompilationSettings();
				if (noEmit) {
					return;
				}
				const packageJsonPath = ts.findConfigFile(sourceFile.fileName, ts.sys.fileExists, 'package.json');
				if (!packageJsonPath) {
					return;
				}
				const packageJson = JSON.parse(ts.sys.readFile(packageJsonPath) ?? '');
				if (packageJson.private) {
					return;
				}
				const parentPackageJsonPath = ts.findConfigFile(path.dirname(path.dirname(packageJsonPath)), ts.sys.fileExists, 'package.json');
				const parentPackageJson = !!parentPackageJsonPath && parentPackageJsonPath !== packageJsonPath
					? JSON.parse(ts.sys.readFile(parentPackageJsonPath) ?? '')
					: {};
				ts.forEachChild(sourceFile, function visit(node) {
					if (
						ts.isImportDeclaration(node)
						&& !node.importClause?.isTypeOnly
						&& ts.isStringLiteral(node.moduleSpecifier)
						&& !node.moduleSpecifier.text.startsWith('./')
						&& !node.moduleSpecifier.text.startsWith('../')
					) {
						let moduleName = node.moduleSpecifier.text.split('/')[0];
						if (moduleName.startsWith('@')) {
							moduleName += '/' + node.moduleSpecifier.text.split('/')[1];
						}
						if (
							(
								packageJson.devDependencies?.[moduleName]
								|| parentPackageJson.dependencies?.[moduleName]
								|| parentPackageJson.devDependencies?.[moduleName]
								|| parentPackageJson.peerDependencies?.[moduleName]
							)
							&& !packageJson.dependencies?.[moduleName]
							&& !packageJson.peerDependencies?.[moduleName]
						) {
							reportError(
								`Module '${moduleName}' should be in the dependencies.`,
								node.getStart(sourceFile),
								node.getEnd()
							);
						}
					}
					ts.forEachChild(node, visit);
				});
			},
		},
		syntactic: {
			/**
			 * @example
			 * ```diff
			 * console.log(obj.prop); // used
			 * - obj.prop; // unused
			 * ```
			 */
			'no-unused-property-access'({ typescript: ts, sourceFile, reportWarning }) {
				ts.forEachChild(sourceFile, function visit(node) {
					if (ts.isPropertyAccessExpression(node)) {
						const parent = node.parent;
						if (ts.isExpressionStatement(parent)) {
							reportWarning(
								`Property '${node.name.text}' is accessed but not used.`,
								node.getStart(sourceFile),
								node.getEnd()
							).withFix(
								'Remove unused property access',
								() => [{
									fileName: sourceFile.fileName,
									textChanges: [
										{
											newText: '',
											span: {
												start: parent.getStart(sourceFile),
												length: parent.getEnd() - parent.getStart(sourceFile),
											},
										}
									],
								}]
							);
						}
					}
					ts.forEachChild(node, visit);
				});
			},
			'no-unused-variable-access'({ typescript: ts, sourceFile, reportWarning }) {
				ts.forEachChild(sourceFile, function visit(node) {
					if (ts.isIdentifier(node)) {
						const parent = node.parent;
						if (ts.isExpressionStatement(parent)) {
							reportWarning(
								`Variable '${node.text}' is accessed but not used.`,
								node.getStart(sourceFile),
								node.getEnd()
							).withFix(
								'Remove unused variable access',
								() => [{
									fileName: sourceFile.fileName,
									textChanges: [
										{
											newText: '',
											span: {
												start: parent.getStart(sourceFile),
												length: parent.getEnd() - parent.getStart(sourceFile),
											},
										}
									],
								}]
							);
						}
					}
					ts.forEachChild(node, visit);
				});
			},
			'no-async-without-await'({ typescript: ts, sourceFile, reportSuggestion }) {
				ts.forEachChild(sourceFile, function visit(node) {
					if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) {
						const awaitModifer = node.modifiers?.find(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword);
						if (awaitModifer && node.body) {
							let hasAwait = false;
							ts.forEachChild(node.body, function visit(node) {
								hasAwait ||= ts.isAwaitExpression(node);
								ts.forEachChild(node, visit);
							});
							if (!hasAwait) {
								reportSuggestion(
									`Function is declared as async but does not use await.`,
									awaitModifer.getStart(sourceFile),
									awaitModifer.getEnd()
								).withRefactor(
									'Remove async modifier',
									() => [{
										fileName: sourceFile.fileName,
										textChanges: [{
											span: {
												start: awaitModifer.getStart(sourceFile),
												length: awaitModifer.getEnd() - awaitModifer.getStart(sourceFile),
											},
											newText: ''
										}]
									}]
								);
							}
						}
					}
					ts.forEachChild(node, visit);
				});
			},
		},
	},
	formatting: [
		/**
		 * @example
		 * ```diff
		 * interface MyInterface {
		 * -   prop: string,
		 * +   prop: string;
		 * }
		 * ```
		 */
		function interfacePropertySemicolon({ typescript: ts, sourceFile, replace, insert }) {
			const { text } = sourceFile;
			ts.forEachChild(sourceFile, function visit(node) {
				if (ts.isInterfaceDeclaration(node)) {
					for (const member of node.members) {
						if (text[member.end - 1] === ',') {
							replace(member.end - 1, member.end, ';');
						}
						else if (text[member.end - 1] !== ';') {
							insert(member.end, ';');
						}
					}
				}
				ts.forEachChild(node, visit);
			});
		},
		/**
		 * @example
		 * ```diff
		 * - if (foo) bar();
		 * + if (foo) {
		 * +   bar();
		 * + }
		 * ```
		 */
		function bracesAroundStatements({ typescript: ts, sourceFile, insert }) {
			ts.forEachChild(sourceFile, function visit(node) {
				if (ts.isIfStatement(node)) {
					if (!ts.isBlock(node.thenStatement)) {
						edit(node.thenStatement);
					}
					if (node.elseStatement && !ts.isIfStatement(node.elseStatement) && !ts.isBlock(node.elseStatement)) {
						edit(node.elseStatement);
					}
				}
				// @ts-expect-error
				else if ('statement' in node && ts.isStatement(node.statement)) {
					const statement = node.statement;
					if (!ts.isBlock(node.statement)) {
						edit(statement);
					}
				}
				ts.forEachChild(node, visit);
			});
			function edit(statement: ts.Statement) {
				insert(
					statement.getFullStart(),
					isSameLine(statement)
						? ' {\n'
						: ' {'
				);
				insert(
					ts.getTrailingCommentRanges(
						sourceFile.text,
						statement.getEnd()
					)?.reverse()?.[0]?.end
					?? statement.getEnd(),
					'\n}'
				);
			}
			function isSameLine(node: ts.Node) {
				return ts.getLineAndCharacterOfPosition(sourceFile, node.getFullStart()).line
					=== ts.getLineAndCharacterOfPosition(sourceFile, node.parent.getEnd()).line;
			}
		},
		/**
		 * @example
		 * ```diff
		 * - const foo = (bar) => {};
		 * + const foo = bar => {};
		 * ```
		 */
		function arrowParens({ typescript: ts, sourceFile, remove }) {
			ts.forEachChild(sourceFile, function visit(node) {
				if (
					ts.isArrowFunction(node)
					&& node.parameters.length === 1
					&& !node.type
				) {
					const parameter = node.parameters[0];
					if (
						ts.isIdentifier(parameter.name)
						&& !parameter.type
						&& !parameter.dotDotDotToken
						&& !parameter.initializer
						&& sourceFile.text[parameter.getStart(sourceFile) - 1] === '('
						&& sourceFile.text[parameter.getEnd()] === ')'
					) {
						remove(parameter.getStart(sourceFile) - 1, parameter.getStart(sourceFile));
						remove(parameter.getEnd(), parameter.getEnd() + 1);
					}
				}
				ts.forEachChild(node, visit);
			});
		},
		function noTrailingCommaInFunction({ typescript: ts, sourceFile, remove }) {
			const { text } = sourceFile;
			ts.forEachChild(sourceFile, function visit(node) {
				if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) {
					const parameters = node.parameters;
					if (parameters.length > 0) {
						const lastParameter = parameters[parameters.length - 1];
						const nextCharIndex = lastParameter.end;
						if (text[nextCharIndex] === ',') {
							remove(nextCharIndex, nextCharIndex + 1);
						}
					}
				}
				ts.forEachChild(node, visit);
			});
		},
		function noTrailingCommaInFunctionCall({ typescript: ts, sourceFile, remove }) {
			const { text } = sourceFile;
			ts.forEachChild(sourceFile, function visit(node) {
				if (ts.isCallExpression(node)) {
					if (node.arguments.length > 0) {
						const lastArgument = node.arguments[node.arguments.length - 1];
						const nextCharIndex = lastArgument.end;
						if (text[nextCharIndex] === ',') {
							remove(nextCharIndex, nextCharIndex + 1);
						}
					}
				}
				ts.forEachChild(node, visit);
			});
		},
		function noUnnecessaryParentheses({ typescript: ts, sourceFile, remove }) {
			ts.forEachChild(sourceFile, function visit(node) {
				if (ts.isParenthesizedExpression(node)) {
					if (
						ts.isIdentifier(node.expression)
						|| ts.isPropertyAccessExpression(node.expression)
						|| ts.isElementAccessExpression(node.expression)
						|| ts.isCallExpression(node.expression)
					) {
						const start = node.getStart(sourceFile);
						const end = node.getEnd();
						remove(start, start + 1);
						remove(end - 1, end);
					}
				}
				ts.forEachChild(node, visit);
			});
		},
	],
});
