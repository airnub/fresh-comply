import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import type {
  StepTypeRegistryEntry,
  StepTypeVersionLedgerEntry,
  TenantSecretBinding,
  TenantStepTypeInstall,
} from "./types";
import { StepTypeActionsClient } from "./step-type-actions.client";

export interface StepTypeActionsProps {
  registry: StepTypeRegistryEntry[];
  versions: StepTypeVersionLedgerEntry[];
  tenantInstalls: TenantStepTypeInstall[];
  secretBindings: TenantSecretBinding[];
}

export function StepTypeActions(props: StepTypeActionsProps) {
  if (props.registry.length === 0 && props.versions.length === 0) {
    return null;
  }

  return (
    <Card variant="surface">
      <Flex direction="column" gap="4">
        <header>
          <Heading size="5">Step type controls</Heading>
          <Text size="2" color="gray">
            Create and publish step types, manage tenant enablement, and bind secret aliases.
          </Text>
        </header>
        <StepTypeActionsClient {...props} />
      </Flex>
    </Card>
  );
}
