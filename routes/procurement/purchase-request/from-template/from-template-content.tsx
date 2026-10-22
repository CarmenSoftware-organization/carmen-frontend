import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { DocFormHeader } from "@/components/share/doc-form-header";
import { Loader2 } from "lucide-react";
import EmptyComponent from "@/components/empty-component";
import SearchInput from "@/components/search-input";
import { usePurchaseRequestTemplates } from "../use-purchase-request";
import TemplateCard from "./template-card";
import { QtyStep } from "./qty-step";
import type { PurchaseRequestTemplate } from "@/types/purchase-request";

const PR_LIST_PATH = "/procurement/purchase-request";

/**
 * เริ่มใบขอซื้อจากเทมเพลต — สองขั้นในหน้าเดียว: เลือกเทมเพลต → กรอกจำนวน
 *
 * เคยเป็น view ที่สองของ dialog สร้าง PR ซึ่งกดเลือกแล้วเด้งเข้าฟอร์มเต็มทันที
 * คนสั่งของประจำสัปดาห์ต้องมาไล่ลบแถวที่รอบนี้ไม่เอาทีละแถวในฟอร์ม ขั้นกรอก
 * จำนวนเลยมาอยู่ก่อน: ตั้ง 0 = ไม่เอารอบนี้ ใบที่ได้มีเฉพาะของที่สั่งจริง
 */
export function FromTemplateContent() {
  const t = useTranslations("procurement.purchaseRequest");
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<PurchaseRequestTemplate | null>(
    null,
  );
  const { data: templates, isLoading } = usePurchaseRequestTemplates(true);

  const term = searchTerm.trim().toLowerCase();
  const filteredTemplates = !term
    ? (templates ?? [])
    : (templates ?? []).filter(
        (template) =>
          template.name?.toLowerCase().includes(term) ||
          template.workflow?.name?.toLowerCase().includes(term),
      );

  const hasTemplates = !isLoading && !!templates && templates.length > 0;

  if (selected) {
    return (
      <QtyStep
        // เปลี่ยนเทมเพลตแล้วจำนวนที่กรอกค้างต้องไม่ตามมาด้วย
        key={selected.id}
        template={selected}
        onBack={() => setSelected(null)}
        // ไม่ยิง API ที่นี่ — ส่งเทมเพลตที่กรองแล้ว (เหลือเฉพาะแถวที่ขอจริง พร้อม
        // จำนวนที่กรอก) ไปเป็น state ของหน้า /new ฟอร์มเต็มรับไปเติมเองด้วยทางเดิม
        // ทุกประการ ใบจริงเกิดตอนกด Save ในฟอร์ม ผู้ใช้ยังได้ตรวจราคา/วันส่งก่อน
        onContinue={(items) =>
          navigate(`${PR_LIST_PATH}/new`, {
            state: {
              template: {
                ...selected,
                purchase_request_template_detail: items,
              },
            },
          })
        }
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <DocFormHeader
        flush
        title={t("selectTemplate")}
        subtitle={t("selectTemplateDesc")}
        onBack={() => navigate(PR_LIST_PATH)}
      />

      <div className="space-y-4 px-10">
        {hasTemplates && (
          <SearchInput
            defaultValue={searchTerm}
            onSearch={setSearchTerm}
            onInputChange={setSearchTerm}
            containerClassName="w-96"
          />
        )}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
          </div>
        )}

        {hasTemplates && filteredTemplates.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => setSelected(template)}
              />
            ))}
          </div>
        )}

        {hasTemplates && filteredTemplates.length === 0 && (
          <div className="py-12">
            <EmptyComponent
              title={t("noTemplateResults")}
              description={t("tryDifferentSearch")}
            />
          </div>
        )}

        {!isLoading && !hasTemplates && (
          <div className="py-12">
            <EmptyComponent
              title={t("noTemplates")}
              description={t("noTemplatesDesc")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
