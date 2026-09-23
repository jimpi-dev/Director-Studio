import { PageShell } from "../../shared/components/PageShell";
import { H3WorkflowSetup } from "./H3WorkflowSetup";
import { LlmSettingsPanel } from "./LlmSettingsPanel";

export function WorkflowSettingsPage({
  active = true,
  onClose,
}: {
  active?: boolean;
  onClose?: () => void;
}) {
  return (
    <PageShell
      title="Settings"
      subtitle="LLM · Workflows / H3"
      className="workflow-settings-page"
      actions={onClose ? (
        <button
          type="button"
          className="settings-close-button"
          aria-label="Close settings"
          title="Close settings"
          onClick={onClose}
        >
          ×
        </button>
      ) : null}
    >
      <LlmSettingsPanel active={active} />
      <H3WorkflowSetup active={active} />
    </PageShell>
  );
}
