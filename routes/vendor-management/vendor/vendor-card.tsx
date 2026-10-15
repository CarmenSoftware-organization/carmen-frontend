import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import {
  ListCard,
  ListCardAuditRows,
  ListCardRow,
  ListCardActiveRow,
} from "@/components/share/list-card";
import { VendorRatingStars } from "./vendor-rating";
import type { Vendor } from "@/types/vendor";

interface VendorCardProps {
  readonly item: Vendor;
  readonly onEdit: (item: Vendor) => void;
  readonly onDelete: (item: Vendor) => void;
}

export default function VendorCard({
  item,
  onEdit,
  onDelete,
}: VendorCardProps) {
  const tfl = useTranslations("field");
  const t = useTranslations("vendorManagement.vendor");

  // list API ส่งผู้ติดต่อมาที่ `contacts` (serializer เปลี่ยนชื่อจาก tb_vendor_contact)
  // อ่านแต่ชื่อเก่าอย่างเดียว การ์ดเลยไม่เคยแสดงผู้ติดต่อ
  const contacts = item.contacts ?? item.tb_vendor_contact ?? [];
  const primaryContact = contacts.find((c) => c.is_primary) ?? contacts[0];

  return (
    <ListCard
      title={item.name || "..."}
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      <ListCardActiveRow active={item.is_active} />
      <ListCardRow label={tfl("code")}>{item.code}</ListCardRow>
      {item.rating != null && (
        <ListCardRow label={t("rating")}>
          <VendorRatingStars value={item.rating} />
        </ListCardRow>
      )}
      {item.business_type?.length > 0 && (
        <ListCardRow label={tfl("businessType")}>
          <span className="flex flex-wrap justify-end gap-1">
            {item.business_type.map((bt) => (
              <Badge key={bt.id} variant="outline" size="xs">
                {bt.name}
              </Badge>
            ))}
          </span>
        </ListCardRow>
      )}
      {primaryContact?.name && (
        <ListCardRow label={tfl("contactPerson")}>
          {primaryContact.name}
        </ListCardRow>
      )}
      {primaryContact?.phone && (
        <ListCardRow label={tfl("phone")}>
          <span className="tabular-nums">{primaryContact.phone}</span>
        </ListCardRow>
      )}
      {primaryContact?.email && (
        <ListCardRow label={tfl("email")}>{primaryContact.email}</ListCardRow>
      )}
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}
