import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import DisplayTemplate from "@/components/display-template";
import EmptyComponent from "@/components/empty-component";
import { Skeleton } from "@/components/ui/skeleton";
import { moduleList, type ModuleDto } from "@/constant/module-list";
import { useCan } from "@/hooks/use-can";
import {
  WORKFLOW_DOC_TYPES,
  useWorkflowsByDocType,
  type WorkflowDocType,
} from "@/hooks/use-workflow";

const WORKFLOW_PATH = "/system-admin/workflow";

/**
 * การ์ดมาจากเมนูย่อยของ workflow ใน `module-list` ตรง ๆ — เพิ่ม/ลบเมนูย่อยแล้วหน้านี้
 * ตามเองโดยไม่ต้องแก้สองที่ (คำอธิบายของการ์ดอยู่ที่ `systemAdmin.workflow.landing.cards`)
 */
function workflowChildren(): ModuleDto[] {
  for (const mod of moduleList)
    for (const sub of mod.subModules ?? [])
      if (sub.path === WORKFLOW_PATH) return sub.subModules ?? [];
  return [];
}

const docTypeOf = (path: string): WorkflowDocType | undefined => {
  const slug = path.replace(`${WORKFLOW_PATH}/`, "");
  return WORKFLOW_DOC_TYPES.find((type) => type === slug);
};

export default function WorkflowLanding() {
  const t = useTranslations("systemAdmin.workflow");
  const { can } = useCan();
  const cards = workflowChildren().filter(
    (sub) => !sub.permission || can(sub.permission),
  );

  return (
    <DisplayTemplate title={t("title")} description={t("desc")}>
      {cards.length === 0 ? (
        <EmptyComponent />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3">
          {cards.map((sub) => (
            <WorkflowLandingCard key={sub.path} sub={sub} />
          ))}
        </div>
      )}
    </DisplayTemplate>
  );
}

function WorkflowLandingCard({ sub }: { readonly sub: ModuleDto }) {
  const t = useTranslations("systemAdmin.workflow.landing");
  const tm = useTranslations("modules");
  const Icon = sub.icon;
  const docType = docTypeOf(sub.path);

  return (
    <Link
      to={sub.path}
      className="bg-card border-border hover:border-primary focus-visible:ring-ring group flex flex-col gap-2 rounded-lg border p-3 shadow-sm transition-colors outline-none focus-visible:ring-2"
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
            <Icon aria-hidden className="text-muted-foreground size-4" />
          </span>
        )}
        <h2 className="text-foreground min-w-0 text-sm font-semibold tracking-tight">
          {tm(sub.name)}
        </h2>
      </div>
      <p className="text-muted-foreground flex-1 text-xs leading-relaxed">
        {t(`cards.${sub.name}`)}
      </p>
      <div className="border-border-subtle text-foreground flex min-h-6 items-center justify-between gap-2 border-t pt-2 text-xs font-medium">
        {docType ? <WorkflowCount docType={docType} /> : <span />}
        <ArrowRight
          aria-hidden
          className="text-muted-foreground group-hover:text-primary size-3.5 shrink-0 transition-colors"
        />
      </div>
    </Link>
  );
}

/** จำนวน workflow ของชนิดเอกสาร — ขอแค่แถวเดียวเพราะใช้แต่ `paginate.total` */
function WorkflowCount({ docType }: { readonly docType: WorkflowDocType }) {
  const t = useTranslations("systemAdmin.workflow.landing");
  const { data, isLoading, isError } = useWorkflowsByDocType(docType, {
    page: 1,
    perpage: 1,
  });

  if (isLoading) return <Skeleton className="h-4 w-20" />;
  // นับไม่ได้ (เช่น ไม่มีสิทธิ์ที่ gateway) ไม่ใช่เหตุให้การ์ดใช้ไม่ได้ — เว้นว่างแล้วให้กดเข้าไปดูเอง
  if (isError || !data) return <span />;
  return <span>{t("count", { count: data.paginate?.total ?? 0 })}</span>;
}
