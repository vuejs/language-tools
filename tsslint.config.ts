import { defineConfig } from '@tsslint/config';
import { convertRules } from '@tsslint/eslint';
import * as path from 'node:path';
import type * as ts from 'typescript';

export default defineConfig({
	rules: {
		semantic: {
			...await convertRules({
				'@typescript-eslint/consistent-type-imports': ['warn', {
					disallowTypeAnnotations: false,
					fixStyle: 'inline-type-imports',
				}],
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
	},
	formatting: [
		function trailingComma({ typescript: ts, sourceFile, insert, remove }) {
			const { text } = sourceFile;
			ts.forEachChild(sourceFile, function visit(node) {
				let lastNode: ts.Node | undefined;
				let end: number | undefined;
				let allow = true;

				if (ts.isObjectLiteralExpression(node)) {
					lastNode = node.properties[node.properties.length - 1];
					end = node.end;
				}
				else if (
					ts.isArrayLiteralExpression(node)
					|| ts.isObjectBindingPattern(node)
					|| ts.isArrayBindingPattern(node)
					|| ts.isNamedImports(node)
					|| ts.isNamedExports(node)
					|| ts.isImportAttributes(node)
					|| ts.isTupleTypeNode(node)
				) {
					lastNode = node.elements[node.elements.length - 1];
					end = node.end;
				}
				else if (ts.isEnumDeclaration(node)) {
					lastNode = node.members[node.members.length - 1];
					end = node.end;
				}
				else if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
					lastNode = node.arguments?.[node.arguments.length - 1];
					end = node.end;
					allow = false;
				}
				else if (ts.isFunctionLike(node)) {
					lastNode = node.parameters[node.parameters.length - 1];
					if (lastNode) {
						const right = 'body' in node && node.body?.getStart(sourceFile) || Infinity;
						const parenIndex = text.indexOf(')', lastNode.end);
						if (parenIndex !== -1 && parenIndex < right) {
							end = parenIndex + 1;
						}
					}
					allow = false;
				}

				if (lastNode && end) {
					const trailings = text.slice(lastNode.end, end - 1);
					const commaIndex = trailings.indexOf(',');
					if (allow && trailings.includes('\n')) {
						if (commaIndex === -1) {
							insert(lastNode.end, ',');
						}
					}
					else if (commaIndex !== -1) {
						const start = lastNode.end + commaIndex;
						remove(start, start + 1);
					}
				}
				ts.forEachChild(node, visit);
			});
		},
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
