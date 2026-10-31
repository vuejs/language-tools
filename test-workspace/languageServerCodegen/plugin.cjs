// A codegen plugin that removes all of the code of `<script setup>`.
exports.codegen = () => ({
	rewrite({ ir }, { scriptSetup }) {
		scriptSetup?.replace(0, ir.scriptSetup.content.length, '');
	},
});
