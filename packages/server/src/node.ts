/**
 * NOTE! This file will be rename to node.ts in future
 */

import * as vscode from 'vscode-languageserver/node';
import { createLanguageServer } from './common';

const connection = vscode.createConnection(vscode.ProposedFeatures.all);

createLanguageServer(connection);
