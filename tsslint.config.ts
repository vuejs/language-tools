import { defineConfig } from '@tsslint/config';
import { defineRules } from '@tsslint/eslint';
import * as path from 'node:path';

export default defineConfig({
	rules: {
		// oxlint's default rules, but without unicorn. See https://oxc.rs/docs/guide/usage/linter/rules.html
		...await defineRules({
			'for-direction': true,
			'no-async-promise-executor': true,
			'no-caller': true,
			'no-class-assign': true,
			'no-compare-neg-zero': true,
			'no-cond-assign': true,
			'no-const-assign': true,
			'no-constant-binary-expression': true,
			'no-constant-condition': true,
			'no-control-regex': true,
			'no-debugger': true,
			'no-delete-var': true,
			'no-dupe-class-members': true,
			'no-dupe-else-if': true,
			'no-dupe-keys': true,
			'no-duplicate-case': true,
			'no-empty-character-class': true,
			'no-empty-pattern': true,
			'no-empty-static-block': true,
			'no-eval': true,
			'no-ex-assign': true,
			'no-extra-boolean-cast': true,
			'no-func-assign': true,
			'no-global-assign': true,
			'no-import-assign': true,
			'no-invalid-regexp': true,
			'no-irregular-whitespace': true,
			'no-loss-of-precision': true,
			'no-new-native-nonconstructor': true,
			'no-nonoctal-decimal-escape': true,
			'no-obj-calls': true,
			'no-self-assign': true,
			'no-setter-return': true,
			'no-shadow-restricted-names': true,
			'no-sparse-arrays': true,
			'no-this-before-super': true,
			'no-unassigned-vars': true,
			'no-unsafe-finally': true,
			'no-unsafe-negation': true,
			'no-unsafe-optional-chaining': true,
			'no-unused-labels': true,
			'no-unused-private-class-members': true,
			// 'no-unused-vars': true,
			'no-useless-backreference': true,
			'no-useless-catch': true,
			'no-useless-escape': true,
			'no-useless-rename': true,
			'no-with': true,
			'require-yield': true,
			'use-isnan': true,
			'valid-typeof': true,
			'@typescript-eslint/await-thenable': true,
			'@typescript-eslint/no-array-delete': true,
			'@typescript-eslint/no-base-to-string': true,
			// '@typescript-eslint/no-confusing-void-expression': true,
			'@typescript-eslint/no-duplicate-enum-values': true,
			'@typescript-eslint/no-duplicate-type-constituents': true,
			'@typescript-eslint/no-extra-non-null-assertion': true,
			// '@typescript-eslint/no-floating-promises': true,
			'@typescript-eslint/no-for-in-array': true,
			'@typescript-eslint/no-implied-eval': true,
			'@typescript-eslint/no-meaningless-void-operator': true,
			'@typescript-eslint/no-misused-new': true,
			'@typescript-eslint/no-misused-spread': true,
			'@typescript-eslint/no-non-null-asserted-optional-chain': true,
			// '@typescript-eslint/no-redundant-type-constituents': true,
			'@typescript-eslint/no-this-alias': true,
			'@typescript-eslint/no-unnecessary-parameter-property-assignment': true,
			'@typescript-eslint/no-unsafe-declaration-merging': true,
			'@typescript-eslint/no-unsafe-unary-minus': true,
			'@typescript-eslint/no-useless-empty-export': true,
			'@typescript-eslint/no-wrapper-object-types': true,
			'@typescript-eslint/prefer-as-const': true,
			'@typescript-eslint/require-array-sort-compare': true,
			'@typescript-eslint/restrict-template-expressions': true,
			'@typescript-eslint/triple-slash-reference': true,
			// '@typescript-eslint/unbound-method': true,
		}),
		// Project-specific rules
		...await defineRules({
			'curly': true,
			'eqeqeq': true,
			'no-unused-expressions': true,
			'require-await': true,
			'@typescript-eslint/consistent-type-imports': [{
				disallowTypeAnnotations: false,
				fixStyle: 'inline-type-imports',
			}],
			'@typescript-eslint/no-unnecessary-type-assertion': true,
			'@typescript-eslint/no-unnecessary-condition': true,
		}),
		'missing-dependency'({ typescript: ts, file, program, report }) {
			const { noEmit } = program.getCompilerOptions();
			if (noEmit) {
				return;
			}
			const packageJsonPath = ts.findConfigFile(file.fileName, ts.sys.fileExists, 'package.json');
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
			ts.forEachChild(file, function visit(node) {
				if (
					ts.isImportDeclaration(node)
					&& !node.importClause?.isTypeOnly
					&& ts.isStringLiteral(node.moduleSpecifier)
					&& !node.moduleSpecifier.text.startsWith('./')
					&& !node.moduleSpecifier.text.startsWith('../')
				) {
					let moduleName = node.moduleSpecifier.text.split('/')[0]!;
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
						report(
							`Module '${moduleName}' should be in the dependencies.`,
							node.getStart(file),
							node.getEnd(),
						);
					}
				}
				ts.forEachChild(node, visit);
			});
		},
	},
});
