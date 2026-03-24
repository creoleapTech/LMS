export interface IClass {
  _id: string;
  grade?: string;
  section: string;
  year?: string;
  institutionId: string | { _id: string; name: string };
  departmentId?: string | { _id: string; name: string };
  studentCount?: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClassDTO {
  grade?: string;
  section: string;
  year?: string;
  institutionId: string;
  departmentId?: string;
  capacity?: number;
}

export interface UpdateClassDTO extends Partial<CreateClassDTO> {
  isActive?: boolean;
}
