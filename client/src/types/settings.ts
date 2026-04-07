// Settings types

export interface IGradeScaleEntry {
  grade: string;
  label: string;
  minPercentage: number;
  maxPercentage: number;
}

export interface IInstitutionNotificationPrefs {
  newStudentRegistration: boolean;
  feePaymentReceived: boolean;
  attendanceAlert: boolean;
  examResultsPublished: boolean;
  holidayAnnouncement: boolean;
}

export interface IInstitutionSettings {
  _id: string;
  institutionId: string;
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  enableStudentPortal: boolean;
  enableParentPortal: boolean;
  gradingScale: IGradeScaleEntry[];
  passingMarks: number;
  notificationPreferences: IInstitutionNotificationPrefs;
  sessionTimeout: number;
}

export interface IUserNotificationPrefs {
  emailNotifications: boolean;
  smsNotifications: boolean;
  attendanceAlerts: boolean;
  examResults: boolean;
  announcements: boolean;
}

export interface IUserPreferences {
  _id: string;
  userId: string;
  userModel: "Admin" | "Staff";
  language: string;
  theme: "light" | "dark" | "system";
  notificationPreferences: IUserNotificationPrefs;
}

export interface IInstitutionProfile {
  _id: string;
  name: string;
  type: "school" | "college";
  address: string;
  contactDetails: {
    inchargePerson: string;
    mobileNumber: string;
    email?: string;
    officePhone?: string;
  };
  isActive: boolean;
}

export interface IUserProfile {
  _id: string;
  name: string;
  email: string;
  salutation?: "Mr" | "Mrs" | "Ms" | "Dr";
  mobileNumber: string;
  profileImage?: string;
  role?: string;
  type?: string;
}
