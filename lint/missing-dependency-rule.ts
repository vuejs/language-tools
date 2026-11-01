import { defineRule } from '@tsslint/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

export default defineRule(({ typescript: ts, file, program, report }) => {
	const { noEmit } = program.getCompilerOptions();
	if (noEmit) {
		return;
	}
	const packageJsonPath = findPackageJson(path.dirname(file.fileName));
	if (!packageJsonPath) {
		return;
	}
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	if (packageJson.private) {
		return;
	}
	const parentPackageJsonPath = findPackageJson(path.dirname(path.dirname(packageJsonPath)));
	const parentPackageJson = !!parentPackageJsonPath && parentPackageJsonPath !== packageJsonPath
		? JSON.parse(fs.readFileSync(parentPackageJsonPath, 'utf8'))
		: {};
	file.forEachChild(function visit(node): void {
		if (
			ts.isImportDeclaration(node)
			&& node.importClause?.phaseModifier !== ts.SyntaxKind.TypeKeyword
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
		node.forEachChild(visit);
	});
});

function findPackageJson(dir: string): string | undefined {
	while (true) {
		const packageJsonPath = path.join(dir, 'package.json');
		if (fs.existsSync(packageJsonPath)) {
			return packageJsonPath;
		}
		const parentDir = path.dirname(dir);
		if (parentDir === dir) {
			return;
		}
		dir = parentDir;
	}
}
