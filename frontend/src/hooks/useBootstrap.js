import useAppData from "./useAppData.js";

export default function useBootstrap() {
  const {
    bootstrap,
    bootstrapError,
    isBootstrapLoading,
    meta,
    refreshBootstrap,
    warnings,
  } = useAppData();

  return {
    bootstrap,
    bootstrapError,
    isBootstrapLoading,
    meta,
    refreshBootstrap,
    warnings,
  };
}
