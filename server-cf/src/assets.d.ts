// Type declarations for static asset imports (bundled by wrangler)
declare module "*.png" {
  const value: string | ArrayBuffer;
  export default value;
}
declare module "*.jpeg" {
  const value: string | ArrayBuffer;
  export default value;
}
