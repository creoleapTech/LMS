export interface Bindings {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_TEACHER_SECRET: string;
  JWT_ADMIN_SECRET: string;
  JWT_SUPERADMIN_SECRET: string;
  CORS_ORIGINS?: string;
  RESEND_API_KEY?: string;
}

export interface Variables {
  user: Record<string, unknown>;
}
