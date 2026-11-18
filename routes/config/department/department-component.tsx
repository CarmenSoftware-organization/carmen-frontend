import { useTranslations } from "use-intl";
import { ConfigListTemplate } from "@/components/templates/config-list-template";
import { useDepartment, useDeleteDepartment } from "@/hooks/use-department";
import type { Department } from "@/types/department";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useDepartmentTable } from "./use-department-table";
import { DEPARTMENT_FILTER_FIELDS } from "./department-filter-fields";
import DepartmentCard from "./department-card";

export default function DepartmentComponent() {
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  return (
    <ConfigListTemplate<Department>
      fixedColumnWidths
      translationNamespace="config.department"
      entityNameField="name"
      useList={useDepartment}
      useDelete={useDeleteDepartment}
      useTable={useDepartmentTable}
      permissionPrefix="configuration.department"
      pageKey={LIST_PAGE_KEYS.DEPARTMENT}
      filterFields={DEPARTMENT_FILTER_FIELDS}
      addPath="/config/department/new"
      getEditPath={(d) => `/config/department/${d.id}`}
      exportColumns={[
        { header: tfl("code"), value: (r) => r.code, width: 14 },
        { header: tfl("name"), value: (r) => r.name, width: 28 },
        {
          header: tfl("description"),
          value: (r) => r.description ?? "",
          width: 40,
        },
        {
          header: tfl("status"),
          value: (r) => (r.is_active ? ts("active") : ts("inactive")),
          width: 10,
        },
      ]}
      renderCard={({ item, onEdit, onDelete, rowNo }) => (
        <DepartmentCard rowNo={rowNo} item={item} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
}
