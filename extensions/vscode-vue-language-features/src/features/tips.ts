import * as data from '../data/tips.json';
import * as vscode from 'vscode';

export function getRandomTipsMessage() {

	if (!vscode.workspace.getConfiguration('volar').get('initializationMessage.tips'))
		return;

	const item = data[Math.floor(Math.random() * data.length)];
	const locales = item.locales as Record<string, string> | undefined;
	return '💡 ' + (locales?.[vscode.env.language] ?? item.message);
}

export function getRandomNewsMessage() {

	if (!vscode.workspace.getConfiguration('volar').get('initializationMessage.news'))
		return;

	// TODO
	return '🗞️';
}
