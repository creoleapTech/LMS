import { useAuthStore } from "@/store/userAuthStore";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Config } from "@/lib/config";
import { Settings, LogOut, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveAcademicYear } from "@/pages/dashboard/useAcademicYear";

// Matches sidebar navItems — single source of truth for page titles
const PAGE_TITLES: { path: string; title: string; subtitle?: string }[] = [
  { path: "/dashboard",   title: "Dashboard",             subtitle: "Overview of your LMS activity" },
  { path: "/curriculum",  title: "Curriculum Management", subtitle: "Manage curriculums, books, chapters and content" },
  { path: "/institutions",title: "Institutions",          subtitle: "Manage schools and colleges" },
  { path: "/my-classes",  title: "Class Management",      subtitle: "Manage your class schedule and teaching activity" },
  { path: "/students",    title: "Student Management",    subtitle: "Manage classes, sections and students" },
  { path: "/reports",     title: "Reports",               subtitle: "Insights and analytics for your LMS" },
  { path: "/settings",    title: "Settings",              subtitle: "Configure your institution and account" },
  { path: "/courses",     title: "Courses",               subtitle: "Manage courses and programs" },
];

function getPageInfo(pathname: string) {
  return PAGE_TITLES.find(
    (p) => pathname === p.path || pathname.startsWith(p.path + "/")
  ) ?? null;
}

function getInstitutionInfo(user: any) {
  if (!user) return { name: "", logo: "" };
  if (typeof user.institutionId === "object" && user.institutionId) {
    return {
      name: user.institutionId.name || "",
      logo: user.institutionId.logo || "",
    };
  }
  return { name: "", logo: "" };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function GlobalHeader() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const institutionId = user
    ? typeof user.institutionId === "object" && user.institutionId
      ? user.institutionId._id
      : typeof user.institutionId === "string"
        ? user.institutionId
        : undefined
    : undefined;
  const { data: academicYear } = useActiveAcademicYear(institutionId);

  if (!user) return null;

  const { name: institutionName, logo: institutionLogo } = getInstitutionInfo(user);
  const isSuperAdmin = user.role === "super_admin";
  const displayName = isSuperAdmin && !institutionName ? "CreaLeap LMS" : institutionName;
  const logoUrl = institutionLogo ? `${Config.imgUrl}${institutionLogo}` : "";

  const pageInfo = getPageInfo(pathname);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate({ to: "/" });
  };

  return (
    <div className="sticky top-0 z-40 neo-glass border-b-0">
      <div className="flex items-center justify-between px-5 sm:px-8 py-3">

        {/* Left: page title always shown */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Institution logo — non-super-admin only */}
          {!isSuperAdmin && (
            logoUrl ? (
              <img
                src={logoUrl}
                alt={displayName}
                className="h-10 w-10 rounded-xl object-cover border border-white/60 shadow-[3px_3px_8px_var(--neo-shadow-dark),-3px_-3px_8px_var(--neo-shadow-light)] shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/30 shrink-0">
                {displayName ? getInitials(displayName) : "LMS"}
              </div>
            )
          )}

          <div className="min-w-0">
            {pageInfo ? (
              <>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate leading-tight">
                  {pageInfo.title}
                </h1>
                {pageInfo.subtitle && (
                  <p className="text-xs text-slate-500 truncate leading-tight hidden sm:block">
                    {pageInfo.subtitle}
                  </p>
                )}
              </>
            ) : (
              /* Fallback: institution name for non-super-admin, nothing for super-admin */
              !isSuperAdmin && displayName && (
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate leading-tight">
                  {displayName}
                </h1>
              )
            )}
          </div>
        </div>

        {/* Right: Academic year + Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {academicYear && !isSuperAdmin && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full">
              <GraduationCap size={16} />
              {academicYear.label}
            </span>
          )}

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer">
                <Avatar className="h-9 w-9">
                  {user.profileImage && (
                    <AvatarImage src={`${Config.imgUrl}${user.profileImage}`} alt={user.name} />
                  )}
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-sm">
                    {getInitials(user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuLabel className="font-normal px-3 py-2">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {user.name || user.email}
                </p>
                <p className="text-sm text-slate-600 capitalize">
                  {user.role?.replace("_", " ")}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate({ to: "/settings" })}
                className="cursor-pointer rounded-lg"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer rounded-lg text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Gradient accent line */}
      <div className="h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 opacity-60" />
    </div>
  );
}
