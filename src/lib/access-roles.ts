export const APP_ROLES = ["corregedor_geral", "subcorregedor_geral", "corregedor_supervisor", "ssp", "cmtg", "corregedor", "cidadao", "mp"] as const;
export type AppRole = (typeof APP_ROLES)[number];
export const ADMIN_ROLES = ["corregedor_geral", "subcorregedor_geral", "corregedor_supervisor"] as const;
export const INTERNAL_ROLES = ["ssp", "cmtg", ...ADMIN_ROLES, "corregedor"] as const;
export const ROLE_LABELS: Record<AppRole, string> = {
  corregedor_geral: "Corregedor-Geral",
  subcorregedor_geral: "Subcorregedor-Geral",
  corregedor_supervisor: "Corregedor Supervisor",
  ssp: "SSP",
  cmtg: "CMTG",
  corregedor: "Corregedor",
  cidadao: "Cidadão",
  mp: "Ministério Público",
};
export const isAdminRole = (role?: string | null) => !!role && (ADMIN_ROLES as readonly string[]).includes(role);
export const isInternalRole = (role?: string | null) => !!role && (INTERNAL_ROLES as readonly string[]).includes(role);
