<script lang="ts">
import type { ComponentProps, ComponentSlots, ComponentEmit, ComponentExposed } from 'vue-type-helpers';
import { exactType } from '../shared';
import ScriptSetup from '../components/script-setup.vue';

exactType((new ScriptSetup()).$props, {} as ComponentProps<typeof ScriptSetup>);
exactType((new ScriptSetup()).$emit, {} as ComponentEmit<typeof ScriptSetup>);
exactType((new ScriptSetup()).$slots, {} as ComponentSlots<typeof ScriptSetup>);
exactType((new ScriptSetup()), {} as ComponentExposed<typeof ScriptSetup>);
</script>
