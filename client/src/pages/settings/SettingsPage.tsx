// app/settings/page.tsx   (or components/settings/SettingsPage.tsx)
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea} from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Bell,
  Shield,
  Save,
  GraduationCap,
  Clock
} from "lucide-react";
import { PeriodConfigSection } from "./components/PeriodConfigSection";

export default function SettingsPage() {
  const handleSave = (section: string) => {
    toast.success(`${section} settings saved successfully!`);
  };

  return (
    <>
      <div className="py-10 px-5 sm:px-8 max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold flex items-center gap-3 tracking-tight">
            <div className="p-2.5 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
              <Building2 className="h-6 w-6" />
            </div>
            Settings
          </h1>
          <p className="text-muted-foreground mt-2">Manage your institution preferences and configuration</p>
        </div>

        <Tabs defaultValue="general" className="space-y-8">
          <TabsList className="flex flex-wrap w-full max-w-4xl h-auto gap-1 rounded-xl p-1">
            <TabsTrigger value="general" className="rounded-lg">General</TabsTrigger>
            <TabsTrigger value="profile" className="rounded-lg">Profile</TabsTrigger>
            <TabsTrigger value="academic" className="rounded-lg">Academic</TabsTrigger>
            <TabsTrigger value="grading" className="rounded-lg">Grading</TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-lg">Notifications</TabsTrigger>
            <TabsTrigger value="security" className="rounded-lg">Security</TabsTrigger>
          </TabsList>

          {/* 1. General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" /> General Settings
                </CardTitle>
                <CardDescription>Basic configuration for your institution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select defaultValue="en">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Time Zone</Label>
                    <Select defaultValue="ist">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ist">India Standard Time (IST)</SelectItem>
                        <SelectItem value="est">Eastern Time (EST)</SelectItem>
                        <SelectItem value="pst">Pacific Time (PST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date Format</Label>
                    <Select defaultValue="ddmmyyyy">
    
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ddmmyyyy">DD/MM/YYYY</SelectItem>
                          <SelectItem value="mmddyyyy">MM/DD/YYYY</SelectItem>
                          <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                
                  </div>

                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select defaultValue="inr">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inr">Indian Rupee (₹)</SelectItem>
                        <SelectItem value="usd">US Dollar ($)</SelectItem>
                        <SelectItem value="eur">Euro (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Enable Student Portal</Label>
                      <p className="text-sm text-muted-foreground">Allow students to log in and view their data</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Enable Parent Portal</Label>
                      <p className="text-sm text-muted-foreground">Allow parents to monitor their child's progress</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => handleSave("General")} className="bg-brand-color rounded-xl shadow-lg shadow-purple-900/20">
                    <Save className="mr-2 h-4 w-4" /> Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 2. Institution Profile */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> Institution Profile
                </CardTitle>
                <CardDescription>Update your institution information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Institution Name</Label>
                    <Input defaultValue="Delhi Public School" />
                  </div>
                  <div className="space-y-2">
                    <Label>Short Code</Label>
                    <Input defaultValue="DPS01" className="uppercase" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Input type="email" defaultValue="admin@dps.edu.in" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <Input defaultValue="+91 98765 43210" />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address</Label>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-2" />
                      <Textarea defaultValue="123 Main Road, Near Central Park, New Delhi - 110001, India" rows={3} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline">Upload Logo</Button>
                  <Button onClick={() => handleSave("Profile")} className="bg-brand-color rounded-xl shadow-lg shadow-purple-900/20">
                    <Save className="mr-2 h-4 w-4" /> Update Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3. Academic Year */}
          <TabsContent value="academic">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" /> Current Academic Year
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="px-6 pb-6 space-y-4">
                    <div className="flex justify-between items-center text-lg font-semibold">
                      <span>2025 - 2026</span>
                      <Badge>Active</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Start Date</Label>
                        <p className="text-sm">April 1, 2025</p>
                      </div>
                      <div>
                        <Label>End Date</Label>
                        <p className="text-sm">March 31, 2026</p>
                      </div>
                    </div>
                    <Button className="w-full" variant="outline">Create New Academic Year</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" /> Terms / Semesters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Semester 1</span>
                      <span className="text-sm text-muted-foreground">Apr - Sep 2025</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Semester 2</span>
                      <span className="text-sm text-muted-foreground">Oct - Mar 2026</span>
                    </div>
                  </div>
                  <Button className="w-full" variant="outline">Manage Terms</Button>
                </CardContent>
              </Card>

              {/* Period / Bell Schedule */}
              <PeriodConfigSection />
            </div>
          </TabsContent>

          {/* 4. Grading System */}
          <TabsContent value="grading">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" /> Grading System
                </CardTitle>
                <CardDescription>Define grade scales and passing criteria</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg border p-6">
                    <h4 className="font-semibold mb-4">Current Grading Scale (10-Point)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {["O (90-100)", "A+ (80-89)", "A (70-79)", "B+ (60-69)", "C (50-59)", "D (40-49)", "F (<40)"].map((grade) => (
                        <Badge key={grade} variant="secondary" className="justify-center py-3 text-sm">
                          {grade}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <Label>Passing Marks</Label>
                      <p className="text-sm text-muted-foreground">Minimum marks required to pass a subject</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input type="number" defaultValue="40" className="w-24" />
                      <span>%</span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => handleSave("Grading")} className="bg-brand-color rounded-xl shadow-lg shadow-purple-900/20">
                      Update Grading System
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 5. Notifications */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" /> Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {["New Student Registration", "Fee Payment Received", "Attendance Alert (<75%)", "Exam Results Published", "Holiday Announcement"].map((item) => (
                  <div key={item} className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">{item}</Label>
                      <p className="text-sm text-muted-foreground">Send notification via email & SMS</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
                <Separator />
                <Button onClick={() => handleSave("Notifications")} className="bg-brand-color rounded-xl shadow-lg shadow-purple-900/20">
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 6. Security */}
          <TabsContent value="security">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-600">
                    <Shield className="h-5 w-5" /> Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Two-Factor Authentication (2FA)</Label>
                    <p className="text-sm text-muted-foreground mb-3">Add an extra layer of security to admin accounts</p>
                    <Button variant="outline">Enable 2FA</Button>
                  </div>
                  <Separator />
                  <div>
                    <Label>Session Timeout</Label>
                    <Select defaultValue="30">
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => handleSave("Security")} className="bg-brand-color rounded-xl shadow-lg shadow-purple-900/20">
                      <Save className="mr-2 h-4 w-4" /> Save Security Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}