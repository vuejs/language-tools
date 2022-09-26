export function isTypeScriptDocument(uri: string) {
	return uri.endsWith('.ts') || uri.endsWith('.tsx');
}
