import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { HighlightText } from "@/components/ui/highlight-text";
import SearchInput from "@/components/search-input";
import EmptyComponent from "@/components/empty-component";
import { useTranslations } from "use-intl";

interface UserTableRow {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  telephone: string;
}

interface UserTableProps {
  readonly users: UserTableRow[];
  readonly className?: string;
}

export function UserTable({ users, className }: UserTableProps) {
  "use no memo";
  const t = useTranslations("common");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const fullName = `${u.firstname} ${u.lastname}`.toLowerCase();
      return (
        fullName.includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.telephone ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const columns: ColumnDef<UserTableRow>[] = useMemo(
    () => [
      {
        id: "index",
        header: "#",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.index + 1}</span>
        ),
        size: 50,
        meta: { headerClassName: "text-center", cellClassName: "text-center" },
      },
      {
        id: "name",
        header: tfl("name"),
        cell: ({ row }) => (
          <HighlightText
            text={`${row.original.firstname} ${row.original.lastname}`}
            query={search}
          />
        ),
      },
      {
        accessorKey: "email",
        header: tfl("email"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            <HighlightText text={row.original.email} query={search} />
          </span>
        ),
      },
      {
        accessorKey: "telephone",
        header: tfl("phone"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            <HighlightText text={row.original.telephone} query={search} />
          </span>
        ),
      },
    ],
    [search, tfl],
  );

  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <div className={cn("space-y-2", className)}>
      <SearchInput
        defaultValue={search}
        containerClassName="w-96"
        onInputChange={setSearch}
        onSearch={setSearch}
      />
      <DataGrid
        table={table}
        recordCount={filteredUsers.length}
        emptyMessage={
          <EmptyComponent
            icon={Users}
            title={t("noData")}
            description={search ? t("noSearchResult") : t("noDataFound")}
          />
        }
      >
        <DataGridContainer>
          <DataGridTable />
        </DataGridContainer>
      </DataGrid>
    </div>
  );
}
