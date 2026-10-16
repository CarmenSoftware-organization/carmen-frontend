/**
 * swagger-ui-dist ไม่มี type ของตัวเอง — ประกาศเฉพาะ entry ที่ใช้
 * (`routes/system-admin/interface/external-api-docs.tsx`) และเฉพาะ option ที่ส่งจริง
 */
declare module "swagger-ui-dist/swagger-ui-es-bundle.js" {
  interface SwaggerUIOptions {
    readonly domNode: HTMLElement;
    readonly spec: object;
    readonly supportedSubmitMethods?: readonly string[];
    readonly tryItOutEnabled?: boolean;
    readonly validatorUrl?: string | null;
    readonly deepLinking?: boolean;
    readonly docExpansion?: "list" | "full" | "none";
    readonly defaultModelsExpandDepth?: number;
    readonly defaultModelExpandDepth?: number;
  }
  const SwaggerUI: (options: SwaggerUIOptions) => unknown;
  export default SwaggerUI;
}
