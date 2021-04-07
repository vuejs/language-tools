import {
    Commands,
    triggerCharacter
} from '@volar/vscode-vue-languageservice';
import {
    CallHierarchyPrepareRequest,
    CompletionRequest,
    DefinitionRequest,
    ExecuteCommandRequest,
    HoverRequest,
    ReferencesRequest,
    RenameRequest,
    SelectionRangeRequest,
    SignatureHelpRequest,
    TypeDefinitionRequest
} from 'vscode-languageserver/node';
import {
    allFilesReg,
    connection,
    vueFileReg
} from '../instances';

connection.client.register(ReferencesRequest.type, vueFileReg);
connection.client.register(DefinitionRequest.type, vueFileReg);
connection.client.register(CallHierarchyPrepareRequest.type, allFilesReg);
connection.client.register(TypeDefinitionRequest.type, vueFileReg);
connection.client.register(HoverRequest.type, vueFileReg);
connection.client.register(RenameRequest.type, {
    documentSelector: vueFileReg.documentSelector,
    prepareProvider: true,
});
connection.client.register(SelectionRangeRequest.type, vueFileReg);
connection.client.register(SignatureHelpRequest.type, {
    documentSelector: vueFileReg.documentSelector,
    triggerCharacters: ['(', ',', '<'],
    retriggerCharacters: [')'],
});
connection.client.register(ExecuteCommandRequest.type, {
    commands: [
        Commands.HTML_TO_PUG,
        Commands.PUG_TO_HTML,
        Commands.SWITCH_REF_SUGAR,
        Commands.SHOW_REFERENCES,
    ]
});
connection.client.register(CompletionRequest.type, {
    documentSelector: vueFileReg.documentSelector,
    triggerCharacters: [...triggerCharacter.typescript, ...triggerCharacter.html],
    resolveProvider: true,
});
