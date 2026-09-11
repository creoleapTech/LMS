export interface IGroupMember {
  _id: string;
  id?: string;
  name: string;
  rollNumber?: string;
  admissionNumber?: string;
  addedAt?: string;
}

export interface IGroup {
  _id: string;
  id?: string;
  name: string;
  description?: string | null;
  classId: string | { _id: string; id?: string; grade?: string; section?: string; year?: string };
  institutionId: string | { _id: string; id?: string; name?: string };
  members?: IGroupMember[];
  memberCount?: number;
  leaderId?: string | null;
  leader?: IGroupMember | null;
  isActive: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateGroupDTO {
  name: string;
  description?: string;
  classId: string;
  institutionId?: string;
  studentIds?: string[];
  leaderId?: string | null;
}

export interface UpdateGroupDTO {
  name?: string;
  description?: string;
  isActive?: boolean;
  studentIds?: string[];
  leaderId?: string | null;
}

export function getGroupClassId(group: IGroup): string {
  if (typeof group.classId === "string") return group.classId;
  return (group.classId as any)?._id ?? (group.classId as any)?.id ?? "";
}

export function getGroupLeaderId(group: IGroup): string {
  if (group.leaderId) return group.leaderId;
  return (group.leader as any)?._id ?? (group.leader as any)?.id ?? "";
}

export function getGroupClassLabel(group: IGroup): string {
  if (typeof group.classId === "string") return "";
  const c = group.classId as any;
  if (!c) return "";
  const grade = c.grade ? `Grade ${c.grade}` : "Class";
  const section = c.section ? `– ${c.section}` : "";
  const year = c.year ? ` (${c.year})` : "";
  return `${grade} ${section}${year}`.trim();
}
