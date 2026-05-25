import type { LanguageServiceContext } from '@volar/language-service';
import type { ComponentMeta, EventMeta, ExposeMeta, PropertyMeta, SlotMeta } from 'vue-component-meta';

const UPDATE_EVENT_PREFIX = 'update:';
const UPDATE_PROP_PREFIX = 'onUpdate:';

const formatterSettings = ['markdown', 'table', 'jsdoc'] as const;
/**
 * The possible settings for the component hover documentation.
 *
 * Keep in sync with `vue.hover.rich` setting in `extensions/vscode/package.json`	`
 *
 * Note: 'off' is also a default value but in this case it is just treaded as
 */
type FormatterSetting = (typeof formatterSettings)[number];

export async function getHoverDocsSetting(context: LanguageServiceContext): Promise<FormatterSetting | null> {
	const configuredValue = await context.env.getConfiguration?.('vue.hover.rich');

	if (formatterSettings.includes(configuredValue as FormatterSetting)) {
		return configuredValue as FormatterSetting;
	}

	if (configuredValue === true) {
		// default to `Table` for backwards compatibility
		return 'table';
	}

	return null;
}

export function formatComponentMeta(meta: ComponentMeta, setting: FormatterSetting): string {
	const formatter = getFormatter(setting);
	return formatter(meta) ?? 'No type information available.';
}

function getFormatter(setting: FormatterSetting): (meta: ComponentMeta) => string | undefined {
	switch (setting) {
		case 'markdown':
			return formatMarkdown;
		case 'table':
			return formatTable;
		case 'jsdoc':
			return formatJSDoc;
	}
}

function formatTable(meta: ComponentMeta) {
	const props = meta.props.filter(p => !p.global);
	const modelProps = extractModelProps(meta);
	const tableContents: string[] = [];

	if (props.length) {
		let table = `<tr><th align="left">Prop</th><th align="left">Description</th><th align="left">Default</th></tr>\n`;
		for (const p of props) {
			table += `<tr>
						<td>${printName(p, modelProps.has(p))}</td>
						<td>${printDescription(p)}</td>
						<td>${p.default ? `<code>${p.default}</code>` : ''}</td>
					</tr>\n`;
		}
		tableContents.push(table);
	}

	if (meta.events.length) {
		let table = `<tr><th align="left">Event</th><th align="left">Description</th><th></th></tr>\n`;
		for (const e of meta.events) {
			table += `<tr>
						<td>${printName(e)}</td>
						<td colspan="2">${printDescription(e)}</td>
					</tr>\n`;
		}
		tableContents.push(table);
	}

	if (meta.slots.length) {
		let table = `<tr><th align="left">Slot</th><th align="left">Description</th><th></th></tr>\n`;
		for (const s of meta.slots) {
			table += `<tr>
						<td>${printName(s)}</td>
						<td colspan="2">${printDescription(s)}</td>
					</tr>\n`;
		}
		tableContents.push(table);
	}

	if (meta.exposed.length) {
		let table = `<tr><th align="left">Exposed</th><th align="left">Description</th><th></th></tr>\n`;
		for (const e of meta.exposed) {
			table += `<tr>
						<td>${printName(e)}</td>
						<td colspan="2">${printDescription(e)}</td>
					</tr>\n`;
		}
		tableContents.push(table);
	}

	if (!tableContents.length) {
		return;
	}

	// 2px height per <tr>
	const tableGap = `<tr></tr>`.repeat(4);

	return `<table>\n${tableContents.join(`\n${tableGap}\n`)}\n</table>`;

	function printName(meta: { name: string; tags: { name: string }[]; required?: boolean }, model?: boolean) {
		let name = meta.name;
		if (meta.tags.some(tag => tag.name === 'deprecated')) {
			name = `<del>${name}</del>`;
		}
		if (meta.required) {
			name += ' <sup><em>required</em></sup>';
		}
		if (model) {
			name += ' <sup><em>model</em></sup>';
		}
		return name;
	}

	function printDescription(meta: { description?: string; type: string }) {
		let desc = `<code>${meta.type}</code>`;
		if (meta.description) {
			// blank line for terminate HTML to support markdown
			// see: https://github.github.com/gfm/#example-118
			desc = `\n\n${meta.description}\n<br>${desc}`;
		}
		return desc;
	}
}

function formatMarkdown(meta: ComponentMeta) {
	const { models, props, events } = extractMetaLists(meta);

	return [
		formatSection('Models', [...models], formatProp),
		formatSection('Props', props, formatProp),
		formatSection('Events', events, formatEvent),
		formatSection('Slots', meta?.slots, formatSlot),
		formatSection('Exposed', meta?.exposed, formatExposed),
	].filter(el => el !== undefined).join('\n\n');

	function formatSection<T extends AnyMeta>(
		title: string,
		metaList: T[] | undefined,
		formatter: (meta: T) => string,
	) {
		if (!metaList?.length) {
			return;
		}

		return `## ${title}\n\n`
			+ metaList.map(meta => {
				let element = formatter(meta);

				if (isDeprecated(meta)) {
					element = `~~${element}~~`;
				}

				return element + formatDescription(meta);
			}).join('\n\n');
	}

	function formatProp(prop: PropertyMeta): string {
		let propString = `\`${prop.name}`;

		if (!prop.required) {
			propString += '?';
		}

		propString += `: ${prop.type}`;

		if (prop.default) {
			propString += ` = ${prop.default}`;
		}

		propString += '`';

		return propString;
	}

	function formatEvent(event: EventMeta | PropertyMeta): string {
		return `\`@${event.name}: ${formatEventType(event)}\``;
	}

	function formatSlot(slot: SlotMeta): string {
		const slotString = `\`#${slot.name}\``;

		const hasSlotProps = slot.type !== '{}' && slot.type !== 'any';
		if (hasSlotProps) {
			return slotString + ` - \`${slot.type}\``;
		}

		return slotString;
	}

	function formatExposed(expose: ExposeMeta): string {
		return `\`${expose.name}: ${expose.type}\``;
	}

	type AnyMeta = PropertyMeta | EventMeta | SlotMeta | ExposeMeta;

	function isDeprecated(meta: AnyMeta) {
		return meta.tags.some(tag => tag.name === 'deprecated');
	}

	function formatDescription(meta: AnyMeta) {
		let description = meta.description;

		if (meta.tags.length) {
			description += '\n\n' + meta.tags.map(tag => `***@${tag.name}*** ${tag.text ?? ''}`).join('\n\n');
		}

		if (description) {
			// prepend each line with '> '
			description = '> ' + description.replace(/\n/g, '\n> ');
		}

		if (description) {
			return `\n\n${description}`;
		}

		return description;
	}
}

function formatJSDoc(meta: ComponentMeta) {
	const { models, props, events } = extractMetaLists(meta);

	return `~~~ts\n` + [
		formatSection('Models', models, formatProp),
		formatSection('Props', props, formatProp),
		formatSection('Events', events, formatEvent),
		formatSection('Slots', meta?.slots, formatSlot),
		formatSection('Exposed', meta?.exposed, formatExposed),
		`~~~\n`,
	].filter(el => el !== undefined).join('\n\n');

	function formatSection<T extends AnyMeta>(
		title: string,
		metaList: T[] | undefined,
		formatter: (meta: T) => string,
	) {
		if (!metaList?.length) {
			return;
		}

		return `interface ${title} {`
			+ metaList.map(meta => {
				let element = formatter(meta);

				return [
					formatDescription(meta),
					`\t${element}`,
				].join('\n');
			}).join('\n')
			+ '\n}';
	}

	function formatProp(prop: PropertyMeta): string {
		let propString = prop.name;

		if (!prop.required) {
			propString += '?';
		}

		propString += `: ${prop.type}`;

		if (prop.default) {
			propString += ` = ${prop.default}`;
		}

		return propString;
	}

	function formatEvent(event: EventMeta | PropertyMeta): string {
		return `@${event.name}: ${formatEventType(event)}`;
	}

	function formatSlot(slot: SlotMeta): string {
		const slotString = `#${slot.name}`;

		const hasSlotProps = slot.type !== '{}' && slot.type !== 'any';
		if (hasSlotProps) {
			return slotString + `: ${slot.type}`;
		}

		return slotString;
	}

	function formatExposed(expose: ExposeMeta): string {
		return `${expose.name}: ${expose.type}`;
	}

	type AnyMeta = PropertyMeta | EventMeta | SlotMeta | ExposeMeta;

	function formatDescription(meta: AnyMeta) {
		let description = meta.description;

		if (meta.tags.length) {
			if (description) {
				description += '\n\n';
			}

			description += meta.tags.map(tag => `@${tag.name} ${tag.text ?? ''}`).join('\n\n');
		}

		if (!description) {
			return '';
		}

		description = '\t/**\n\t * ' + description.replace(/\n/g, '\n\t * ');

		return '\n' + description + '\n\t */';
	}
}

/**
 * Extracts the following from ComponentMeta:
 * - models: Props that are usably with v-model
 * - props: Removes global, model, and event props
 * - events: Removes model events and adds event props
 */
function extractMetaLists(meta: ComponentMeta) {
	const propsMap = new Map(
		meta.props
			.filter(p => !p.global)
			.map(prop => [prop.name, prop]),
	);

	const models: PropertyMeta[] = [];
	const propEvents: PropertyMeta[] = [];

	for (const prop of propsMap.values()) {
		// Props starting with `onX` are considered event props by Vue
		if (/^on[A-Z]/.test(prop.name)) {
			propEvents.push({
				...prop,
				name: prop.name.slice(2, 3).toLowerCase() + prop.name.slice(3),
			});
			propsMap.delete(prop.name);
		}
	}

	const events = [...meta.events, ...propEvents].filter(event => {
		if (!event.name.startsWith(UPDATE_EVENT_PREFIX)) {
			return true;
		}

		const modelName = event.name.slice(UPDATE_EVENT_PREFIX.length);
		const modelProp = propsMap.get(modelName);

		if (!modelProp) {
			return true;
		}

		models.push(modelProp);
		propsMap.delete(modelName);
		return false;
	});

	return {
		models,
		props: [...propsMap.values()],
		events,
	};
}

function extractModelProps(meta: ComponentMeta) {
	const props = meta.props.filter(p => !p.global);
	const modelProps = new Set<PropertyMeta>();

	for (const event of meta.events ?? []) {
		if (event.name.startsWith(UPDATE_EVENT_PREFIX)) {
			const modelName = event.name.slice(UPDATE_EVENT_PREFIX.length);
			const modelProp = props?.find(p => p.name === modelName);
			if (modelProp) {
				modelProps.add(modelProp);
			}
		}
	}
	for (const prop of props ?? []) {
		if (prop.name.startsWith(UPDATE_PROP_PREFIX)) {
			const modelName = prop.name.slice(UPDATE_PROP_PREFIX.length);
			const modelProp = props?.find(p => p.name === modelName);
			if (modelProp) {
				modelProps.add(modelProp);
			}
		}
	}

	return modelProps;
}

/**
 * Extracts the event type from the EventMeta / PropertyMeta
 */
function formatEventType(event: EventMeta | PropertyMeta): string {
	// only `EventMeta` has the `signature` property
	if ('signature' in event) {
		// the signature is the only stable source between the different ways of writing
		// a `defineEmit`
		// It looks like `(event: MouseEvent, value: string): void` and we want to extract
		// the parameters afters the event (e.g. `(value: string) => any`)
		const match = event.signature.match(/\([^,]*,? ?(.*)\)/);
		const params = match?.[1] ?? '';

		return `(${params}) => any`;
	}

	// for prop based events we just use the `type` as is
	return event.type;
}
