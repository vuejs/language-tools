export interface ServerInitializationOptions {
    mode: 'api' | 'doc' | 'html',
    appRoot: string,
    language: string,
    tsPlugin: boolean,
    tsdk: string | undefined,
}
