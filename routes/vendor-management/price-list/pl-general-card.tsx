import { Controller, type UseFormReturn } from "react-hook-form";
import {
  Field,
  FieldDatePicker,
  FieldInput,
  FieldLabel,
  FieldPlainText,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { LookupCurrency } from "@/components/lookup/lookup-currency";
import { LookupVendor } from "@/components/lookup/lookup-vendor";
import { PRICE_LIST_STATUS_OPTIONS } from "@/constant/price-list";
import { SettingSection } from "@/components/ui/setting-section";
import type { PriceList, PriceListStatus } from "@/types/price-list";
import type { PriceListFormValues } from "./pl-form-schema";
import { PlPeriodCell } from "./pl-period-cell";

type PlStatus = PriceListStatus;

interface PLGeneralCardProps {
  readonly form: UseFormReturn<PriceListFormValues>;
  readonly priceList?: PriceList;
  readonly isView: boolean;
  readonly isDisabled: boolean;
  readonly watchedFrom: string;
  readonly watchedTo: string;
  readonly tfl: (key: string) => string;
  readonly t: (key: string) => string;
  readonly ts: (key: PlStatus) => string;
}

export function PLGeneralCard({
  form,
  priceList,
  isView,
  isDisabled,
  watchedFrom,
  watchedTo,
  tfl,
  t,
  ts,
}: PLGeneralCardProps) {
  return (
    <SettingSection
      first
      title={tfl("general")}
      description={t(isView ? "generalDescView" : "generalDesc")}
    >
      {/* Name — โหมดดูไม่แสดง แถบหัวมีชื่อเป็นตัวเอกอยู่แล้ว (ท่าเดียวกับหน้าผู้ขาย) */}
      {!isView && (
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="pl-name">
            {tfl("name")}
            {!isView && <span className="text-destructive"> *</span>}
          </FieldLabel>
          {isView ? (
            <FieldPlainText>{form.getValues("name")}</FieldPlainText>
          ) : (
            <FieldInput
              id="pl-name"
              placeholder={t("namePlaceholder")}
              disabled={isDisabled}
              error={form.formState.errors.name?.message}
              maxLength={100}
              {...form.register("name")}
            />
          )}
        </Field>
      )}

      {/* Vendor */}
      <Field>
        <FieldLabel>
          {tfl("vendor")}
          {!isView && <span className="text-destructive"> *</span>}
        </FieldLabel>
        {isView ? (
          <FieldPlainText>{priceList?.vendor?.name}</FieldPlainText>
        ) : (
          <Controller
            control={form.control}
            name="vendor_id"
            render={({ field }) => (
              <LookupVendor
                value={field.value}
                onValueChange={field.onChange}
                disabled={isDisabled}
                className="w-full"
                defaultLabel={priceList?.vendor?.name ?? undefined}
                error={form.formState.errors.vendor_id?.message}
              />
            )}
          />
        )}
      </Field>

      {/* Currency */}
      <Field>
        <FieldLabel>
          {tfl("currency")}
          {!isView && <span className="text-destructive"> *</span>}
        </FieldLabel>
        {isView ? (
          <FieldPlainText>{priceList?.currency?.code}</FieldPlainText>
        ) : (
          <Controller
            control={form.control}
            name="currency_id"
            render={({ field }) => (
              <LookupCurrency
                value={field.value}
                onValueChange={field.onChange}
                disabled={isDisabled}
                fullWidth
                error={form.formState.errors.currency_id?.message}
              />
            )}
          />
        )}
      </Field>

      {/* Effective period — โหมดดูรวมเป็นช่องเดียวพร้อมบรรทัดบอกว่ายังใช้ได้อยู่ไหม
          (สถานะ ACTIVE ไม่ได้แปลว่าช่วงราคายังไม่หมด — ตัวเดียวกับคอลัมน์ในหน้า list) */}
      {isView ? (
        <Field className="sm:col-span-2">
          <FieldLabel>{tfl("effectivePeriod")}</FieldLabel>
          {watchedFrom && watchedTo ? (
            // ห่อด้วย FieldPlainText ให้ Field จับเป็นโหมดดู (label เงียบ, ขนาดตัวอักษร
            // ชุดเดียวกับช่องอื่น) — flex-col เพราะมีบรรทัดสถานะช่วงอยู่ใต้วันที่
            <FieldPlainText className="flex-col items-start justify-center">
              <PlPeriodCell period={`${watchedFrom} - ${watchedTo}`} />
            </FieldPlainText>
          ) : (
            <FieldPlainText />
          )}
        </Field>
      ) : (
        <>
          {/* Effective from */}
          <Field>
            <FieldLabel required>{tfl("effectiveFrom")}</FieldLabel>
            <Controller
              control={form.control}
              name="effective_from_date"
              render={({ field }) => (
                <FieldDatePicker
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isDisabled}
                  className="w-full"
                  placeholder={tfl("pickDate")}
                  error={form.formState.errors.effective_from_date?.message}
                />
              )}
            />
          </Field>

          {/* Effective to */}
          <Field>
            <FieldLabel required>{tfl("effectiveTo")}</FieldLabel>
            <Controller
              control={form.control}
              name="effective_to_date"
              render={({ field }) => (
                <FieldDatePicker
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isDisabled}
                  className="w-full"
                  placeholder={tfl("pickDate")}
                  fromDate={watchedFrom ? new Date(watchedFrom) : undefined}
                  error={form.formState.errors.effective_to_date?.message}
                />
              )}
            />
          </Field>
        </>
      )}

      {/* Description */}
      <Field className="sm:col-span-2">
        <FieldLabel>{tfl("description")}</FieldLabel>
        {isView ? (
          <FieldPlainText className="whitespace-pre-wrap">
            {priceList?.description}
          </FieldPlainText>
        ) : (
          <Textarea
            placeholder={tfl("optional")}
            rows={2}
            maxLength={256}
            disabled={isDisabled}
            className="resize-none"
            {...form.register("description")}
          />
        )}
      </Field>

      {/* Status — โหมดดูไม่แสดง แถบหัวมีสถานะอยู่แล้ว */}
      {!isView && (
        <Field>
          <FieldLabel>{tfl("status")}</FieldLabel>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <FieldSelect
                value={field.value}
                onValueChange={field.onChange}
                disabled={isDisabled}
                placeholder={tfl("selectStatus")}
                error={form.formState.errors.status?.message}
              >
                <SelectContent>
                  {PRICE_LIST_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {/* ไอคอนในตัวเลือกด้วย ไม่ใช่แค่ข้อความ — ค่าที่เลือกแล้ว
                          ถูก render ซ้ำที่ trigger จึงเห็นไอคอนเดียวกับที่ตาราง
                          และตัวกรองแสดง */}
                      <StatusIconLabel
                        status={opt.value}
                        label={ts(opt.value as PlStatus)}
                        className="uppercase"
                      />
                    </SelectItem>
                  ))}
                </SelectContent>
              </FieldSelect>
            )}
          />
        </Field>
      )}
    </SettingSection>
  );
}
