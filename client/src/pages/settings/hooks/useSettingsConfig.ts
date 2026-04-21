import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  User,
  Building2,
  Globe,
  Calendar,
  GraduationCap,
  Bell,
  Shield,
} from "lucide-react";
import { useAuthStore } from "@/store/userAuthStore";
import { ProfileSection } from "../components/ProfileSection";
import { InstitutionProfileSection } from "../components/InstitutionProfileSection";
import { GeneralSettingsSection } from "../components/GeneralSettingsSection";
import { AcademicSection } from "../components/AcademicSection";
import { GradingSection } from "../components/GradingSection";
import { NotificationSection } from "../components/NotificationSection";
import { SecuritySection } from "../components/SecuritySection";

export interface TabDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
}

const ALL_TABS: Record<string, TabDefinition> = {
  profile: { id: "profile", label: "Profile", icon: User, component: ProfileSection },
  "institution-profile": { id: "institution-profile", label: "Institution", icon: Building2, component: InstitutionProfileSection },
  general: { id: "general", label: "General", icon: Globe, component: GeneralSettingsSection },
  academic: { id: "academic", label: "Academic", icon: Calendar, component: AcademicSection },
  grading: { id: "grading", label: "Grading", icon: GraduationCap, component: GradingSection },
  notifications: { id: "notifications", label: "Notifications", icon: Bell, component: NotificationSection },
  security: { id: "security", label: "Security", icon: Shield, component: SecuritySection },
};

const TABS_BY_ROLE: Record<string, string[]> = {
  super_admin: ["profile"],
  admin: ["profile", "institution-profile", "general", "academic", "grading", "notifications", "security"],
  teacher: ["profile", "notifications"],
  staff: ["profile", "notifications"],
};

const SUBTITLES: Record<string, string> = {
  super_admin: "Manage your account and preferences",
  admin: "Manage your institution preferences and configuration",
  teacher: "Manage your account and teaching preferences",
  staff: "Manage your account and preferences",
};

export function useSettingsConfig() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || "teacher";

  const tabIds = TABS_BY_ROLE[role] || TABS_BY_ROLE.teacher;
  const tabs = tabIds.map((id) => ALL_TABS[id]).filter(Boolean);

  return {
    tabs,
    defaultTab: "profile",
    subtitle: SUBTITLES[role] || SUBTITLES.teacher,
  };
}
