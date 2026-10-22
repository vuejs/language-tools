import { posix as path } from 'path-browserify';
import type { Node } from 'typescript-7/ast' with { 'resolution-mode': 'import' };
import type { Project, Snapshot } from 'typescript-7/async' with { 'resolution-mode': 'import' };
import { getComponentMeta } from './componentMeta';
import type { MetaCheckerOptions, TypeScript } from './types';

export function createCheckerBase(
	ts: TypeScript,
	tsconfig: string,
	checkerOptions: MetaCheckerOptions,
) {
	tsconfig = tsconfig.replace(/\\/g, '/');

	const api = new ts.API({ cwd: path.dirname(tsconfig), runExternalCode: true });
	const files = new Map<string, string>();
	const removedPaths = new Set<string>();

	let snapshot: Snapshot | undefined;
	let project: Project | undefined;
	let invalidateAll = false;

	return {
		async getExportNames(componentPath: string) {
			return (await getExports(componentPath)).map(e => e.name);
		},
		async getComponentMeta(componentPath: string, exportName = 'default') {
			const project = await getProject();
			const componentNode = await getExport(componentPath, exportName);
			if (!componentNode) {
				throw new Error(`Export '${exportName}' not found in '${componentPath}'.`);
			}
			const componentType = await project.checker.getTypeAtLocation(componentNode);
			return await getComponentMeta(ts, project, api.printer, componentNode, componentType, checkerOptions);
		},
		updateFile(fileName: string, text: string) {
			fileName = fileName.replace(/\\/g, '/');
			files.set(fileName, text);
			removedPaths.delete(fileName);
			project = undefined;
		},
		deleteFile(fileName: string) {
			fileName = fileName.replace(/\\/g, '/');
			files.delete(fileName);
			removedPaths.add(fileName);
			project = undefined;
		},
		reload() {
			invalidateAll = true;
			project = undefined;
		},
		clearCache() {
			files.clear();
			removedPaths.clear();
			this.reload();
		},
		async getProgram() {
			return (await getProject()).program;
		},
		async close() {
			await api.close();
		},
	};

	async function getProject() {
		if (!project) {
			const previous = snapshot;
			snapshot = await api.createSnapshot({
				openProjects: [tsconfig],
				fileSystem: {
					kind: 'layer',
					files: Object.fromEntries(files),
					removedPaths: [...removedPaths],
				},
				fileNotifications: invalidateAll ? { invalidateAll: true } : undefined,
			});
			invalidateAll = false;
			await previous?.dispose();
			project = snapshot.getConfiguredProject(tsconfig);
			if (!project) {
				throw new Error(`Failed to open project '${tsconfig}'.`);
			}
		}
		return project;
	}

	async function getExports(componentPath: string) {
		const { checker, program } = await getProject();
		componentPath = componentPath.replace(/\\/g, '/');
		if (!await program.getSourceFile(componentPath)) {
			throw new Error(
				`'${componentPath}' is not part of the project. `
					+ `Use a tsconfig that includes it, or call \`updateFile()\` to add it.`,
			);
		}
		const moduleSymbol = await checker.getSymbolOfSourceFile(componentPath);
		return moduleSymbol ? await checker.getExportsOfModule(moduleSymbol) : [];
	}

	async function getExport(componentPath: string, exportName: string): Promise<Node | undefined> {
		const symbol = (await getExports(componentPath)).find(e => e.name === exportName);
		const decl = await symbol?.valueDeclaration?.resolve();
		if (decl) {
			if (ts.isExportAssignment(decl)) {
				return decl.expression;
			}
			if (ts.isVariableDeclaration(decl)) {
				return decl.initializer;
			}
		}
	}
}
