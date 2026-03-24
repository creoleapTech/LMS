
import { useQuery } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, BookOpen, GraduationCap, MapPin, User, PhoneCall, MailIcon, Phone, Pencil, LayoutDashboard, Zap, Activity, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardProps {
    id: string;
    institution: any;
    onEdit: () => void;
    onTabChange: (tab: string) => void;
}

export function InstitutionDashboard({ id, institution, onEdit, onTabChange }: DashboardProps) {
    // Fetch Stats
    const { data: stats, isLoading } = useQuery({
        queryKey: ["institutionStats", id],
        queryFn: async () => {
            const res = await _axios.get(`/admin/institutions/${id}/stats`);
            return res.data.data;
        },
    });

    if (isLoading) return <DashboardSkeleton />;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 1. HERO STATS ROW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsWidget
                    title="Total Students"
                    value={stats?.totalStudents || 0}
                    trend="+12% this month"
                    icon={GraduationCap}
                    gradient="from-blue-500 to-indigo-500"
                    shadowColor="shadow-blue-500/20"
                />
                <StatsWidget
                    title="Total Staff"
                    value={stats?.totalStaff || 0}
                    trend="+5 new joined"
                    icon={Users}
                    gradient="from-emerald-500 to-teal-500"
                    shadowColor="shadow-emerald-500/20"
                />
                <StatsWidget
                    title="Active Classes"
                    value={stats?.totalClasses || 0}
                    trend="Currently running"
                    icon={BookOpen}
                    gradient="from-purple-500 to-pink-500"
                    shadowColor="shadow-purple-500/20"
                />
            </div>

            {/* 2. BENTO GRID LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN (2/3) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* PROFILE CARD */}
                    <Card className="overflow-hidden border-none shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl ring-1 ring-slate-200 dark:ring-slate-800">
                        <div className="absolute top-0 right-0 p-8 bg-brand-color/50 rounded-full blur-[100px] pointer-events-none" />
                        <CardHeader className="relative border-b !pb-0 border-slate-100 dark:border-slate-800 ">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-color/10 rounded-xl">
                                        <LayoutDashboard className="h-6 w-6 text-brand-color" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl">Institution Details</CardTitle>
                                        <CardDescription>Core information and contact details</CardDescription>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={onEdit} className="hover:bg-brand-color/10 hover:text-brand-color transition-colors">
                                    <Pencil className="h-5 w-5" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
                                <div className="px-6 space-y-6">
                                    <DetailRow icon={MapPin} label="Address" value={institution.address} />
                                    <DetailRow icon={User} label="Incharge" value={institution.contactDetails.inchargePerson} />
                                </div>
                                <div className="px-6 space-y-6 bg-slate-50/50 dark:bg-slate-800/20">
                                    <div className="space-y-6">
                                        <DetailRow icon={PhoneCall} label="Mobile" value={institution.contactDetails.mobileNumber} />
                                        <DetailRow icon={MailIcon} label="Email" value={institution.contactDetails.email || "N/A"} />
                                        {institution.contactDetails.officePhone && (
                                            <DetailRow icon={Phone} label="Office Phone" value={institution.contactDetails.officePhone} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* QUICK ACTIONS ROW */}
                    {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <ActionCard
                            icon={Users}
                            label="Manage Staff"
                            color="text-purple-600 dark:text-purple-400"
                            bg="bg-purple-50 dark:bg-purple-900/20 after:bg-purple-500"
                            onClick={() => onTabChange("staff")}
                        />
                        <ActionCard
                            icon={BookOpen}
                            label="Manage Classes"
                            color="text-emerald-600 dark:text-emerald-400"
                            bg="bg-emerald-50 dark:bg-emerald-900/20 after:bg-emerald-500"
                            onClick={() => onTabChange("classes")}
                        />
                        <ActionCard
                            icon={GraduationCap}
                            label="View Students"
                            color="text-blue-600 dark:text-blue-400"
                            bg="bg-blue-50 dark:bg-blue-900/20 after:bg-blue-500"
                            onClick={() => onTabChange("students")}
                        />
                        <ActionCard
                            icon={Zap}
                            label="Settings"
                            color="text-orange-600 dark:text-orange-400"
                            bg="bg-orange-50 dark:bg-orange-900/20 after:bg-orange-500"
                            onClick={onEdit}
                        />
                    </div> */}
                </div>

                {/* RIGHT COLUMN (1/3) */}
                <div className="space-y-6">
                    {/* SYSTEM HEALTH */}
                    {/* <Card className="relative overflow-hidden border-none shadow-lg bg-slate-900 text-white">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/30 rounded-full blur-[50px]" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-green-400" /> System Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 relative z-10">
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-slate-400 text-sm">Overall Health</p>
                                    <p className="text-3xl font-bold tracking-tight">98%</p>
                                </div>
                                <div className="h-10 w-24 bg-gradient-to-r from-green-500/10 to-green-500/20 rounded-lg border border-green-500/30 flex items-center justify-center">
                                    <span className="text-green-400 font-bold text-sm">Excellent</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>Storage</span>
                                    <span>45%</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full w-[45%] bg-blue-500 rounded-full" />
                                </div>
                            </div>
                        </CardContent>
                    </Card> */}

                    {/* TIMELINE */}
                    <Card className="border-none shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl ring-1 ring-slate-200 dark:ring-slate-800">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Clock className="h-5 w-5 text-muted-foreground" /> Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative pl-4 border-l-2 border-slate-100 dark:border-slate-800 space-y-8">
                                <TimelineItem
                                    date={new Date(institution.updatedAt).toLocaleDateString()}
                                    title="Last Updated"
                                    desc="Institution details were modified"
                                    active
                                />
                                <TimelineItem
                                    date={new Date(institution.createdAt).toLocaleDateString()}
                                    title="Registration"
                                    desc="Account created successfully"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// --- SUBCOMPONENTS ---

function StatsWidget({ title, value, trend, icon: Icon, gradient, shadowColor }: any) {
    return (
        <div className={cn(
            "group relative overflow-hidden rounded-3xl p-6 transition-all duration-300 hover:scale-[1.02] cursor-default",
            "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800",
            "shadow-xl hover:shadow-2xl",
            shadowColor
        )}>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Icon className="h-32 w-32 -mr-8 -mt-8" />
            </div>
            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-muted-foreground font-sans tracking-wide uppercase">{title}</p>
                    <h3 className="text-4xl font-extrabold mt-2 tracking-tight text-slate-900 dark:text-white">
                        {value}
                    </h3>
                    <p className="text-xs font-semibold mt-3 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 py-1 px-3 rounded-full w-fit flex items-center gap-1">
                        <Zap className="h-3 w-3 fill-current" /> {trend}
                    </p>
                </div>
                <div className={cn("p-4 rounded-2xl bg-gradient-to-br text-white shadow-lg", gradient)}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </div>
    )
}

function DetailRow({ icon: Icon, label, value }: any) {
    return (
        <div className="group flex items-start gap-4">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl group-hover:bg-brand-color/10 group-hover:text-brand-color transition-colors">
                <Icon className="h-5 w-5 text-slate-500 dark:text-slate-400 group-hover:text-brand-color transition-colors" />
            </div>
            <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5 leading-snug">{value}</p>
            </div>
        </div>
    )
}

function ActionCard({ icon: Icon, label, color, bg, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "relative group flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden",
                "after:absolute after:bottom-0 after:left-0 after:h-1 after:w-full after:scale-x-0 after:transition-transform hover:after:scale-x-100",
                bg
            )}
        >
            <div className={cn("p-3 rounded-xl bg-slate-50 dark:bg-slate-800 transition-colors group-hover:bg-white dark:group-hover:bg-slate-700", color)}>
                <Icon className="h-6 w-6" />
            </div>
            <span className="font-semibold text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                {label}
            </span>
        </button>
    )
}

function TimelineItem({ date, title, desc, active }: any) {
    return (
        <div className="relative group">
            <div className={cn(
                "absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ring-2",
                active ? "bg-green-500 ring-green-500/20" : "bg-slate-300 dark:bg-slate-700 ring-slate-200"
            )} />
            <div>
                <span className="text-xs font-mono text-muted-foreground">{date}</span>
                <p className="font-semibold text-sm text-slate-900 dark:text-white mt-0.5">{title}</p>
                <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </div>
        </div>
    )
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-3xl" />)}
            </div>
            <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 space-y-6">
                    <Skeleton className="h-64 rounded-3xl" />
                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
                    </div>
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-48 rounded-3xl" />
                    <Skeleton className="h-64 rounded-3xl" />
                </div>
            </div>
        </div>
    )
}
