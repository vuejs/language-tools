<script lang="ts">
import type { ComponentEmit, ComponentExposed, ComponentProps, ComponentSlots } from 'vue-component-type-helpers';
import { exactType } from '../shared';
import type scriptSetupGeneric from '../components/script-setup-generic.vue';
import ScriptSetup from '../components/script-setup.vue';

exactType((new ScriptSetup()).$props, {} as ComponentProps<typeof ScriptSetup>);
exactType((new ScriptSetup()).$emit, {} as ComponentEmit<typeof ScriptSetup>);
exactType((new ScriptSetup()).$slots, {} as ComponentSlots<typeof ScriptSetup>);
exactType((new ScriptSetup()), {} as ComponentExposed<typeof ScriptSetup>);
exactType({} as ComponentExposed<typeof scriptSetupGeneric>, {} as { baz: unknown, buz: 1; });
</script>
