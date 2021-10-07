const ts = require('typescript/lib/tsserverlibrary');
const vue = require('vscode-vue-languageservice');
const path = require('path');

exports.createProgramProxy = (options) => {

    if (!options.options.noEmit) {
        throw 'emit mode is not yet support';
    }

    const fileNames = [...options.rootNames.map(rootName => options.host.realpath(rootName)), ...getVueFileNames()];
    const scriptSnapshots = new Map();
    const vueLsHost = {
        ...options.host,
        writeFile: undefined,
        getCompilationSettings: () => options.options,
        getScriptFileNames: () => fileNames,
        getScriptVersion: () => '',
        getScriptSnapshot,
        getProjectVersion: () => '',
    };
    const vueLs = vue.createLanguageService({ typescript: ts }, vueLsHost);
    const program = vueLs.__internal__.tsProgramProxy;

    return program;

    function getVueFileNames() {
        const parseConfigHost = {
            useCaseSensitiveFileNames: options.host.useCaseSensitiveFileNames(),
            readDirectory: (path, extensions, exclude, include, depth) => {
                return options.host.readDirectory(path, ['.vue'], exclude, include, depth);
            },
            fileExists: fileName => options.host.fileExists(fileName),
            readFile: fileName => options.host.readFile(fileName),
        };
        const tsConfig = options.options.configFilePath;
        if (tsConfig) {
            const tsConfigFile = ts.readJsonConfigFile(tsConfig, options.host.readFile);
            const { fileNames } = ts.parseJsonSourceFileConfigFileContent(tsConfigFile, parseConfigHost, path.dirname(tsConfig), options.options, path.basename(tsConfig));
            return fileNames;
        }
        return [];
    }
    function getScriptSnapshot(fileName) {
        const scriptSnapshot = scriptSnapshots.get(fileName);
        if (scriptSnapshot) {
            return scriptSnapshot;
        }
        if (options.host.fileExists(fileName)) {
            const fileContent = options.host.readFile(fileName);
            const scriptSnapshot = ts.ScriptSnapshot.fromString(fileContent);
            scriptSnapshots.set(fileName, scriptSnapshot);
            return scriptSnapshot;
        }
    }
}
