export interface Bindings {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_TEACHER_SECRET: string;
  JWT_ADMIN_SECRET: string;
  JWT_SUPERADMIN_SECRET: string;
}

export interface Variables {
  user: Record<string, unknown>;
}
