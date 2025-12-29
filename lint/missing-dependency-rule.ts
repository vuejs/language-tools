import { defineRule } from '@tsslint/config';
import * as path from 'node:path';

export default defineRule(({ typescript: ts, file, program, report }) => {
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
});
