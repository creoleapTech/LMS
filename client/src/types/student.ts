export interface IStudent {
  _id: string;
  name: string;
  rollNumber?: string;
  admissionNumber?: string;
  email?: string;
  mobileNumber?: string;
  parentName: string;
  parentMobile: string;
  parentEmail?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  admissionDate?: string;
  profileImage?: string;
  classId: string | { _id: string; grade: string; section: string };
  institutionId: string | { _id: string; name: string };
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentDTO {
  name: string;
  rollNumber?: string;
  admissionNumber?: string;
  email?: string;
  mobileNumber?: string;
  parentName: string;
  parentMobile: string;
  parentEmail?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  address?: string;
  admissionDate?: string;
  classId: string;
  // institutionId is handled by backend usually, but for super admin we might need it. 
  // For this context, it's inferred from class or passed explicitly.
  institutionId?: string; 
}

export interface UpdateStudentDTO extends Partial<CreateStudentDTO> {
  isActive?: boolean;
}
