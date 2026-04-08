import { createContext, useContext } from "react";

interface SettingsInstitutionContextValue {
  institutionId: string | null;
}

const SettingsInstitutionContext = createContext<SettingsInstitutionContextValue>({
  institutionId: null,
});

export const SettingsInstitutionProvider = SettingsInstitutionContext.Provider;

export function useSettingsInstitution() {
  return useContext(SettingsInstitutionContext);
}
