import { useContext } from "react";
import { AppDataContext } from "../context/AppDataContext.jsx";

export default function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData deve essere usato dentro AppDataProvider.");
  }

  return context;
}
