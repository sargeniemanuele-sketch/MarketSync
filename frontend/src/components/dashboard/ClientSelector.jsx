import { useId } from "react";
import Select from "../ui/Select.jsx";
import useAppData from "../../hooks/useAppData.js";

export default function ClientSelector({
  className = "",
  clients: providedClients,
  disabled = false,
  id,
  label = "Cliente",
  loading: providedLoading,
  onChange,
  value: providedValue,
  variant,
  ...props
}) {
  const generatedId = useId();
  const appData = useAppData();
  const clients = providedClients ?? appData.clients;
  const loading = providedLoading ?? appData.isBootstrapLoading;
  const value = providedValue ?? appData.selectedClientId ?? "";
  const hasClients = clients.length > 0;
  const options = clients.map((client) => ({
    label: client.name || client.companyName || client.email || client.id,
    value: client.id || client.clientId || client.value,
  }));

  function handleChange(event) {
    const clientId = event.target.value;

    if (onChange) {
      onChange(clientId, event);
      return;
    }

    appData.selectClient(clientId);
  }

  return (
    <Select
      aria-busy={loading}
      className={className}
      disabled={disabled || loading || !hasClients}
      id={id || `client-selector-${generatedId}`}
      label={label}
      onChange={handleChange}
      options={options}
      placeholder={loading ? "Caricamento clienti" : hasClients ? "Seleziona cliente" : "Nessun cliente"}
      value={value}
      variant={variant}
      {...props}
    />
  );
}
