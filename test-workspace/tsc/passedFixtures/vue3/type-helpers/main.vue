<script lang="ts">
import type { ComponentProps, ComponentSlots, ComponentEmit, ComponentExposed } from 'vue-component-type-helpers';
import { exactType } from '../../shared';
import ScriptSetup from '../components/script-setup.vue';
import scriptSetupGeneric from '../components/script-setup-generic.vue';

exactType((new ScriptSetup()).$props, {} as ComponentProps<typeof ScriptSetup>);
exactType((new ScriptSetup()).$emit, {} as ComponentEmit<typeof ScriptSetup>);
exactType((new ScriptSetup()).$slots, {} as ComponentSlots<typeof ScriptSetup>);
exactType((new ScriptSetup()), {} as ComponentExposed<typeof ScriptSetup>);
exactType({} as ComponentExposed<typeof scriptSetupGeneric>, {} as { baz: unknown, buz: 1 })
</script>
