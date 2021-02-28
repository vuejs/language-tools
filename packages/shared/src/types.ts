export interface ServerInitializationOptions {
    mode: 'api' | 'doc' | 'html',
    appRoot: string,
    language: string,
    config: {
        'volar.style.defaultLanguage': string | undefined,
    },
}
