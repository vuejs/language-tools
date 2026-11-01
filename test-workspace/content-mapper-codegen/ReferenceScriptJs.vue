<script>
/// <reference path="./referencedScriptJs.d.ts" />
export default {};
</script>

<script setup>
defineProps({ foo: String });
/** @type {number} */
const referenced = REFERENCED_BY_SCRIPT;
</script>
