export interface ServerInitializationOptions {
	mode: 'api' | 'doc' | 'html',
	typescript: {
		serverPath: string,
		localizedPath: string | undefined,
	}
	enableFindReferencesInTsScript?: boolean,
}
