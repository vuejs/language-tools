export function patchBuildInfoRoots(roots: string[]): string[] {
	return roots
		.filter(file => !file.toLowerCase().includes('__vls_'))
		.map(file => file.replace(/\.vue\.(j|t)sx?$/i, '.vue'));
}
