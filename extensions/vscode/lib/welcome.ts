import * as vscode from 'vscode';

const welcomeVersion = '3.0.7';

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
	if (
		context.globalState.get<boolean>('vue.showUpdates', true)
		&& context.globalState.get('vue.welcome') !== welcomeVersion
	) {
		context.globalState.update('vue.welcome', welcomeVersion);
		execute(context);
	}
}

export function execute(context: vscode.ExtensionContext) {
	if (panel) {
		panel.reveal(vscode.ViewColumn.One);
		return;
	}
	panel = vscode.window.createWebviewPanel(
		'vue.welcome',
		'Welcome to Vue',
		vscode.ViewColumn.One,
		{ enableScripts: true },
	);
	panel.webview.html = getWelcomeHtml(context);
	panel.webview.onDidReceiveMessage(message => {
		switch (message.command) {
			case 'toggleShowUpdates':
				context.globalState.update('vue.showUpdates', message.value);
				break;
		}
	});
	panel.onDidDispose(() => panel = undefined);
}

function getWelcomeHtml(context: vscode.ExtensionContext) {
	const { version, displayName } = context.extension.packageJSON;
	return /* HTML */ `
<!DOCTYPE html>
<html lang="en">

<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${displayName}</title>
	<script>
		const vscode = acquireVsCodeApi();
		function toggleShowUpdates(value) {
			vscode.postMessage({ command: 'toggleShowUpdates', value });
		}
	</script>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			line-height: 1.6;
			max-width: 900px;
			margin: 0 auto;
			padding: 2rem;
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
		}

		header {
			display: flex;
			align-items: center;
			gap: 2rem;
			margin: 1rem 0;
			justify-content: center;
			text-align: center;
			flex-wrap: wrap;
		}

		h1 {
			margin: 0;
			font-size: 2.5rem;
			font-weight: 600;
			color: var(--vscode-textPreformat-foreground);
		}

		h2 {
			margin-top: 2rem;
			font-weight: 500;
			color: var(--vscode-terminal-ansiGreen);
			position: relative;
			padding-bottom: 0.75rem;
		}

		h2::after {
			content: "";
			position: absolute;
			bottom: 0;
			left: 0;
			width: 60px;
			height: 3px;
			background-color: var(--vscode-terminal-ansiGreen);
		}

		h3 {
			color: var(--vscode-textPreformat-foreground);
			margin-top: 0;
		}

		a {
			color: var(--vscode-textLink-foreground);
			text-decoration: none;
			font-weight: 500;
			transition: all 0.2s ease;
		}

		a:hover {
			color: var(--vscode-textLink-activeForeground);
			text-decoration: underline;
		}

		ul {
			padding-left: 1.5rem;
		}

		li {
			margin-bottom: 0.75rem;
		}

		.card {
			border-radius: 12px;
			padding: 2rem;
			// margin: 2rem 0;
			background-color: var(--vscode-sideBar-background);
			box-shadow: 0 2px 8px var(--vscode-widget-shadow);
		}

		.whats-new-card {
			max-height: 250px;
			overflow-y: auto;
			overflow-x: hidden;
		}

		.sponsors-card #sponsors-container svg {
			width: 100% !important;
			height: auto !important;
		}

		.sponsors-card svg image {
			transition: transform 0.3s ease, opacity 0.3s ease;
			transform-box: fill-box;
			transform-origin: center;
			outline-offset: 4px;
		}

		.sponsors-card svg image:hover {
			transform: scale(1.2);
			outline: 2px solid #ffffff;
			outline-offset: 4px;
		}

		.sponsors-card svg:hover image:not(:hover) {
			transform: scale(0.95);
			opacity: 0.3;
		}

		.links {
			display: flex;
			gap: 1.5rem;
			justify-content: center;
			margin: 1.5rem 0;
			flex-wrap: wrap;
		}

		.links a {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		.features {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
			gap: 1.5rem;
			margin: 2rem 0;
		}

		.feature {
			padding: 1.5rem;
			border-radius: 10px;
			background-color: var(--vscode-sideBar-background);
			transition: transform 0.2s ease;
			box-shadow: 0 2px 8px var(--vscode-widget-shadow);
		}

		.feature:hover {
			transform: translateY(-3px);
		}

		.feature-icon {
			font-size: 1.5rem;
			margin-bottom: 1rem;
			color: var(--vscode-terminal-ansiGreen);
		}

		details {
			margin-bottom: 1rem;
			border-radius: 6px;
			overflow: hidden;
			background-color: var(--vscode-sideBar-background);
		}

		summary {
			cursor: pointer;
			font-weight: 500;
			padding: 0.8rem 1rem;
			background-color: var(--vscode-editor-lineHighlightBackground);
			outline: none;
			transition: background-color 0.2s ease;
		}

		summary:hover {
			background-color: var(--vscode-editor-lineHighlightBorder);
		}

		details[open] summary {
			background-color: var(--vscode-editor-lineHighlightBorder);
		}

		details div {
			padding: 1rem;
		}

		.video-container {
			position: relative;
			padding-bottom: 56.25%;
			/* 16:9 */
			height: 0;
			overflow: hidden;
			// margin: 2rem 0;
			border-radius: 12px;
			background-color: var(--vscode-sideBar-background);
			box-shadow: 0 4px 12px var(--vscode-widget-shadow);
		}

		.video-container * {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			border: none;
		}

		@media (max-width: 768px) {
			body {
				padding: 1.5rem;
			}

			header {
				flex-direction: column;
				gap: 1.5rem;
				margin: 2rem 0;
			}

			h1 {
				font-size: 2rem;
			}

			.card,
			.feature {
				padding: 1.25rem;
			}
		}
	</style>
</head>

<body>
	<header style="margin: 0;">
		<svg alt="Vue Logo" width="80" height="80" version="1.1" viewBox="0 0 261.76 226.69"
			xmlns="http://www.w3.org/2000/svg">
			<g transform="matrix(1.3333 0 0 -1.3333 -76.311 313.34)">
				<g transform="translate(178.06 235.01)">
					<path d="m0 0-22.669-39.264-22.669 39.264h-75.491l98.16-170.02 98.16 170.02z" fill="#41b883" />
				</g>
				<g transform="translate(178.06 235.01)">
					<path d="m0 0-22.669-39.264-22.669 39.264h-36.227l58.896-102.01 58.896 102.01z" fill="#34495e" />
				</g>
			</g>
		</svg>
		<div>
			<h1>${displayName} <sup><small>${version}</small></sup></h1>
			<div class="links">
				<a href="https://github.com/vuejs/language-tools" target="_blank">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;">
						<path fill-rule="evenodd" clip-rule="evenodd"
							d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
					</svg>
					GitHub
				</a>
				<a href="https://github.com/vuejs/language-tools/releases" target="_blank">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;">
						<path
							d="M21 10.975V8a2 2 0 00-2-2h-6V4.688c.305-.274.5-.668.5-1.11a1.5 1.5 0 00-3 0c0 .442.195.836.5 1.11V6H5a2 2 0 00-2 2v2.998l-.072.005A.999.999 0 002 12v2a1 1 0 001 1v5a2 2 0 002 2h14a2 2 0 002-2v-5a1 1 0 001-1v-1.975a1 1 0 00-.928-.997L21 10.975zm-5 5.025H8v-3h8v3z" />
					</svg>
					Releases
				</a>
				<a href="https://vuejs.org/" target="_blank">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;">
						<path
							d="M12.001 1.993C6.486 1.994 2 6.48 2 11.994c0 5.514 4.486 9.999 10 10 5.515 0 10.001-4.485 10.001-10s-4.486-10-10-10.001zM12 19.994c-4.412 0-8.001-3.589-8.001-8s3.589-8 8-8.001C16.411 3.994 20 7.583 20 11.994c0 4.41-3.589 8-8 8z" />
						<path
							d="M12.001 8.994l-4.005 4.005 1.414 1.414 2.591-2.591 2.591 2.591 1.414-1.414-4.005-4.005z" />
					</svg>
					Website
				</a>
				<a href="https://discord.gg/vue" target="_blank">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;">
						<path
							d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 00-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 00-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-.99 0-1.8-.9-1.8-2s.79-2.01 1.8-2.01c1 0 1.81.9 1.81 2.01-.01 1.1-.8 2-1.81 2zm6.96 0c-.99 0-1.8-.9-1.8-2s.79-2.01 1.8-2.01c1 0 1.81.9 1.81 2.01-.01 1.1-.8 2-1.81 2z" />
					</svg>
					Discord
				</a>
			</div>
		</div>
	</header>
	<hr>

	<div style="display: flex; justify-content: center; margin: 1.5rem 0;">
		<label>
			<input type="checkbox" onchange="toggleShowUpdates(this.checked)" ${
		context.globalState.get<boolean>('vue.showUpdates', true) ? 'checked' : ''
	}>
			<span>Show release notes on update</span>
		</label>
	</div>

	<div class="card whats-new-card">
		<h3>3.0.7</h3>
		<ul style="margin: 0; padding-left: 1.25rem;">
			<li>✨ The following features are now available for free:</li>
			<ul style="margin: 0; padding-left: 1.25rem;">
				<li>🧩 Interpolation Highlight</li>
				<li>🧩 Focus Mode (disabled by default)</li>
				<li>🧩 Reactivity Visualization</li>
			</ul>
			<li>🐛 4+ bug fixes</li>
		</ul>
		<div
			style="margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
			<a href="https://github.com/vuejs/language-tools/releases/tag/v3.0.7" target="_blank"
				style="display: inline-flex; align-items: center; gap: 0.5rem; color: var(--vscode-textLink-foreground);">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
				</svg>
				Full Release Notes
			</a>
			<div style="display: flex; gap: 0.5rem; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
				<span>Released: September 2025</span>
				<span>•</span>
				<span>v3.0.7</span>
			</div>
		</div>
		<br>

		<h3>3.0.6</h3>
		<ul style="margin: 0; padding-left: 1.25rem;">
			<li>🚀 Expandable Hovers support for TypeScript (<a href="https://code.visualstudio.com/updates/v1_100#_expandable-hovers-for-javascript-and-typescript-experimental" target="_blank">Learn More</a>)</li>
			<li>🐛 8+ bug fixes</li>
		</ul>
		<div
			style="margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
			<a href="https://github.com/vuejs/language-tools/releases/tag/v3.0.6" target="_blank"
				style="display: inline-flex; align-items: center; gap: 0.5rem; color: var(--vscode-textLink-foreground);">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
				</svg>
				Full Release Notes
			</a>
			<div style="display: flex; gap: 0.5rem; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
				<span>Released: August 2025</span>
				<span>•</span>
				<span>v3.0.6</span>
			</div>
		</div>
		<br>

		<h3>3.0.2</h3>
		<ul style="margin: 0; padding-left: 1.25rem;">
			<li>🚀 Improve memory usage in extreme cases</li>
			<li>🐛 15+ bug fixes</li>
		</ul>
		<div
			style="margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
			<a href="https://github.com/vuejs/language-tools/releases/tag/v3.0.2" target="_blank"
				style="display: inline-flex; align-items: center; gap: 0.5rem; color: var(--vscode-textLink-foreground);">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
				</svg>
				Full Release Notes
			</a>
			<div style="display: flex; gap: 0.5rem; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
				<span>Released: July 2025</span>
				<span>•</span>
				<span>v3.0.2</span>
			</div>
		</div>
		<br>

		<h3>3.0.0</h3>
		<ul style="margin: 0; padding-left: 1.25rem;">
			<li>🚀 Significantly improved Hybrid Mode stability</li>
			<li>✨ Introduced several new DX enhancement features</li>
			<li>🌍 Expanded support for additional localizations</li>
			<li>🎨 UI tweaks: removed all Vue-related status bar items</li>
			<li>🐛 Squashed numerous bugs throughout the extension</li>
		</ul>
		<div
			style="margin-top: 1rem; padding: 0.75rem; background-color: var(--vscode-inputValidation-warningBackground); border-radius: 4px;">
			<strong>⚠️ Deprecation Notice:</strong> Dropping Vue 2 Support in v3.1
			(<a href="https://github.com/vuejs/language-tools/discussions/5455" target="_blank">Discussion #5395</a>)
		</div>

		<div
			style="margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
			<a href="https://github.com/vuejs/language-tools/releases/tag/v3.0.0" target="_blank"
				style="display: inline-flex; align-items: center; gap: 0.5rem; color: var(--vscode-textLink-foreground);">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
				</svg>
				Full Release Notes
			</a>
			<div style="display: flex; gap: 0.5rem; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
				<span>Released: July 2025</span>
				<span>•</span>
				<span>v3.0.0</span>
			</div>
		</div>
	</div>

	<h2>🎥 Learn More Features</h2>
	<p>Discover advanced capabilities of the extension:</p>
	<div class="video-container">
		<a href="https://www.youtube.com/watch?v=RcPcO4_Ct_U" target="_blank">
			<iframe
				src="https://www.youtube.com/embed/RcPcO4_Ct_U"
				style="pointer-events: none;"
				frameborder="0"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowfullscreen
				onload="handleVideoSuccess()"
			></iframe>
		</a>
	</div>
	<p id="video-reminder" style="margin-top: 0.5rem; text-align: center; color: var(--vscode-foreground);">
		⚠️ Unable to load the video? <a href="https://www.youtube.com/watch?v=RcPcO4_Ct_U">Watch on YouTube</a>
	</p>
	<script>
		function handleVideoSuccess() {
			const reminder = document.getElementById('video-reminder');
			if (reminder) reminder.style.display = 'none';
		}
	</script>

	<h2>✨ Core Features</h2>
	<div class="features">
		<div class="feature">
			<div class="feature-icon">🧩</div>
			<h3>Template Intelligence</h3>
			<p>Smart completions for directives, components and props in Vue templates with type inference</p>
		</div>
		<div class="feature">
			<div class="feature-icon">🔍</div>
			<h3>Type Checking</h3>
			<p>Full TypeScript support with type inference across SFCs and reactive type checking</p>
		</div>
		<div class="feature">
			<div class="feature-icon">🎨</div>
			<h3>Syntax Highlighting</h3>
			<p>Comprehensive syntax highlighting for Single File Components and template expressions</p>
		</div>
	</div>

	<h2>📚 Resources</h2>
	<ul>
		<li><a href="https://vuejs.org/guide/typescript/overview.html" target="_blank">Vue with TypeScript Guide</a> -
			Official documentation</li>
		<li><a href="https://vuejs.org/guide/scaling-up/tooling.html" target="_blank">Tooling Guide</a> - Recommended
			setup for Vue projects</li>
		<li><a href="https://github.com/vuejs/language-tools/discussions" target="_blank">Discussions</a> - Share ideas
			and get help</li>
	</ul>

	<h2>🔧 Troubleshooting</h2>
	<details>
		<summary>Why are some features not working?</summary>
		<div>
			<p>Make sure you have:</p>
			<ul>
				<li>The latest version of the extension installed</li>
				<li>Vue 3.x in your project dependencies</li>
				<li>TSDK 5.3 or later</li>
				<li>Try disabling other extensions to rule out conflicts</li>
			</ul>
		</div>
	</details>
	<details>
		<summary>Where to report issues?</summary>
		<div>
			<p>Please report any problems on our <a href="https://github.com/vuejs/language-tools/issues"
					target="_blank">GitHub Issues</a> page with:</p>
			<ul>
				<li>Detailed reproduction steps</li>
				<li>Screenshots or screencasts if applicable</li>
				<li>Your project setup information</li>
			</ul>
		</div>
	</details>

	<h2>❤️ Thanks to Our Sponsors</h2>
	<div class="card sponsors-card" style="text-align: center; padding: 1.5rem;">
		<p style="margin-top: 0;">This project is made possible thanks to our generous sponsors:</p>
		<div id="sponsors-container" style="max-width: 100%; margin: 0 auto;"></div>
		<script type="module">
			const container = document.getElementById('sponsors-container');
			try {
				const res = await fetch('https://cdn.jsdelivr.net/gh/johnsoncodehk/sponsors/sponsors.svg');
				const svg = await res.text();
				container.innerHTML = svg;
			}
			catch {
				container.textContent = 'Failed to load sponsors';
			}
		</script>
		<p style="margin-bottom: 0;">
			<a href="https://github.com/sponsors/johnsoncodehk" target="_blank">Become a sponsor</a> to support Vue
			tooling development
		</p>
	</div>
</body>

</html>`;
}
