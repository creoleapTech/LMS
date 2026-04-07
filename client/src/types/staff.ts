export type StaffType = "teacher" | "admin";

export type Salutation = "Mr" | "Mrs" | "Ms" | "Dr";

export interface IStaff {
  _id: string;
  name: string;
  salutation?: Salutation;
  email: string;
  mobileNumber: string;
  type: StaffType;
  subjects?: string[];
  assignedClasses?: string[]; // IDs or Populated Objects depending on usage
  joiningDate: string; // ISO Date string
  profileImage?: string;
  institutionId: string | { _id: string; name: string; type: string }; // Populated or ID
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStaffDTO {
  name: string;
  salutation?: Salutation;
  email: string;
  mobileNumber: string;
  type: StaffType;
  subjects?: string[];
  assignedClasses?: string[];
  joiningDate?: string;
  profileImage?: string;
  institutionId: string;
  password?: string;
}

export interface UpdateStaffDTO extends Partial<CreateStaffDTO> {
  isActive?: boolean;
}
