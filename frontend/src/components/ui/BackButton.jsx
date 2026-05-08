import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "./Button.jsx";

export default function BackButton({
  className = "",
  fallbackTo,
  label = "Torna indietro",
  onClick,
  size = "md",
  to,
  variant = "secondary",
  ...props
}) {
  const navigate = useNavigate();

  function handleClick(event) {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    if (to) {
      navigate(to);
      return;
    }

    if (fallbackTo && window.history.length <= 1) {
      navigate(fallbackTo, { replace: true });
      return;
    }

    navigate(-1);
  }

  return (
    <Button
      className={className}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
