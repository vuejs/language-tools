// A codegen plugin that removes all of the code of `<script setup>`.
exports.codegen = () => ({
	contribute({ ir }) {
		const block = ir.scriptSetup;
		if (block?.content.length) {
			return { scriptEdits: [{ block, replace: { start: 0, end: block.content.length }, code: [] }] };
		}
	},
});
