export interface IAcademicYearTerm {
  label: string;
  startDate: string;
  endDate: string;
}

export interface IAcademicYear {
  _id: string;
  institutionId: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  terms: IAcademicYearTerm[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}
