// A codegen plugin that removes all of the code of `<script setup>`.
exports.codegen = ({ ir }) => ({
	rewrite({ scriptSetup }) {
		scriptSetup?.replace(0, ir.scriptSetup.content.length, '');
	},
});
