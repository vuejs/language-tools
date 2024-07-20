import { h } from 'vue';

function FooBar(props: { stuffAndThings: number; }) {
	return h('div', `Made it: ${props.stuffAndThings}`);
}

FooBar.props = {
	stuffAndThings: {
		type: Number,
		required: true,
	},
};

export default FooBar;
