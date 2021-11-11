import * as vscode from 'vscode-languageserver/browser';
import { createLanguageServer } from './common';

const messageReader = new vscode.BrowserMessageReader(self);
const messageWriter = new vscode.BrowserMessageWriter(self);
const connection = vscode.createConnection(messageReader, messageWriter);

createLanguageServer(connection);
