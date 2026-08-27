import { useI18n } from "../../i18n";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({ open, name, onCancel, onConfirm, loading }: ConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <Modal
      open={open}
      title={t("common.confirmDelete", { name })}
      description={t("common.confirmDeleteHint")}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {t("common.delete")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{name}</p>
    </Modal>
  );
}
