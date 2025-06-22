import { defineConfig } from '@tsslint/config';
import { convertRules } from '@tsslint/eslint';
import * as path from 'node:path';

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
				const parentPackageJsonPath = ts.findConfigFile(
					path.dirname(path.dirname(packageJsonPath)),
					ts.sys.fileExists,
					'package.json',
				);
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
								node.getEnd(),
							);
						}
					}
					ts.forEachChild(node, visit);
				});
			},
		},
	},
});
