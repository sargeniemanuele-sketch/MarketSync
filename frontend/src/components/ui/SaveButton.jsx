import { Save } from "lucide-react";
import Button from "./Button.jsx";

export default function SaveButton({
  className = "",
  disabled = false,
  label = "Salva",
  loading = false,
  loadingLabel = "Salvataggio...",
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}) {
  return (
    <Button
      className={className}
      disabled={disabled || loading}
      isLoading={loading}
      size={size}
      type={type}
      variant={variant}
      {...props}
    >
      <Save className="h-4 w-4" aria-hidden="true" />
      {loading ? loadingLabel : label}
    </Button>
  );
}
