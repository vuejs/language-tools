import * as vscode from 'vscode';

export { register as registerAutoInsertion } from './features/autoInsertion';
export { register as registerShowVirtualFiles } from './features/showVirtualFiles';
export { register as registerWriteVirtualFiles } from './features/writeVirtualFiles';
export { register as registerFileReferences } from './features/fileReferences';
export { register as registerReloadProjects } from './features/reloadProject';
export { register as registerServerStats } from './features/serverStatus';
export { register as registerTsConfig } from './features/tsconfig';
export { register as registerShowReferences } from './features/showReferences';
export { register as registerServerSys } from './features/serverSys';
export { register as registerTsVersion, getTsdk } from './features/tsVersion';

export function takeOverModeActive(context: vscode.ExtensionContext) {
	if (vscode.workspace.getConfiguration('volar').get<string>('takeOverMode.extension') === context.extension.id) {
		return !vscode.extensions.getExtension('vscode.typescript-language-features');
	}
	return false;
}
