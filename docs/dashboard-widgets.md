# Dashboard widgets

> ไฟล์นี้ **สร้างอัตโนมัติ ห้ามแก้มือ** — `bun run docs:widgets` (ดู `scripts/gen-widget-docs.ts`)
>
> ภาพถ่ายจาก `https://dev.blueledgers.com:4001` เมื่อ 2026-10-22T01:59:39.447Z
> ส่วนที่ 2 เป็นข้อมูลใน DB ของ platform — แก้ผ่าน carmen-backstage ได้โดยไม่มี commit และแต่ละ env/BU อาจต่างจากนี้

dataset 89 ตัว · system widget 63 ตัว · bu_default 8 ตัว

## สารบัญ

1. [แคตตาล็อก dataset](#1-แคตตาล็อก-dataset)
   - [config](#ds-group-config) (5)
   - [document](#ds-group-document) (24)
   - [equipment](#ds-group-equipment) (2)
   - [inventory](#ds-group-inventory) (18)
   - [pricelist](#ds-group-pricelist) (4)
   - [procurement](#ds-group-procurement) (8)
   - [product](#ds-group-product) (12)
   - [recipe](#ds-group-recipe) (8)
   - [rfp](#ds-group-rfp) (3)
   - [vendor](#ds-group-vendor) (3)
   - [workflow](#ds-group-workflow) (2)
2. [widget สำเร็จรูป](#2-widget-สำเร็จรูป)
3. [ภาคผนวก](#3-ภาคผนวก)

## 1. แคตตาล็อก dataset

ตัวแปรที่แสดงคือตัวที่ผู้ใช้ตั้งได้เท่านั้น ตัวที่ระบบเติมเอง (เช่น user ปัจจุบัน) ไม่อยู่ในรายการ

ไม่รวม dataset ทดลอง (`lab.*`)

<a id="ds-group-config"></a>

### config

<a id="ds-config-cn-by-reason"></a>

#### `config.cn-by-reason` — Credit notes by reason

- **ชื่อไทย:** ใบลดหนี้แยกตามเหตุผล
- **คำอธิบาย:** Reasons appearing on credit notes, ranked (source view holds 10)
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` | 10 | — |

<a id="ds-config-exchange-rate-latest"></a>

#### `config.exchange-rate-latest` — Latest exchange rates

- **ชื่อไทย:** อัตราแลกเปลี่ยนล่าสุด
- **คำอธิบาย:** Most recent rate for each configured currency
- **shape:** `categorical` · **หน่วย:** rate · **หมวด:** spend
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:** ไม่มี

<a id="ds-config-location-active-count"></a>

#### `config.location-active-count` — Active locations

- **ชื่อไทย:** สถานที่ที่ใช้งาน
- **คำอธิบาย:** Total active inventory locations
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-config-tax-profile-by-rate"></a>

#### `config.tax-profile-by-rate` — Tax profiles by rate

- **ชื่อไทย:** Tax profile แยกตามอัตรา
- **คำอธิบาย:** Distribution of active tax profiles across tax rates (%)
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** spend
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:** ไม่มี

<a id="ds-config-vendor-by-business-type"></a>

#### `config.vendor-by-business-type` — Vendors by business type

- **ชื่อไทย:** Vendor แยกตามประเภทธุรกิจ
- **คำอธิบาย:** Business types ranked by number of vendors (source view holds 10)
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** spend
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` | 10 | — |

<a id="ds-group-document"></a>

### document

<a id="ds-document-grn-by-status"></a>

#### `document.grn-by-status` — Good Received Note by status

- **ชื่อไทย:** ใบรับสินค้าแยกตามสถานะ
- **คำอธิบาย:** Good Received Note documents grouped by status over the selected time range
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-document-grn-count"></a>

#### `document.grn-count` — Good Received Note count

- **ชื่อไทย:** จำนวนใบรับสินค้า
- **คำอธิบาย:** Number of Good Received Note documents in the selected time range, optional status filter
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |
  | `status` | Status | text | `draft` `saved` `committed` `voided` | — | — |

<a id="ds-document-grn-created-series"></a>

#### `document.grn-created-series` — Good Received Note created (series)

- **ชื่อไทย:** ใบรับสินค้าที่สร้าง (ซีรีส์)
- **คำอธิบาย:** Good Received Note documents created per day over the selected time range
- **shape:** `time_series` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `line` `area` `bar` `sparkline`
- **FE วาดได้จริง:** `bar` `line` `area`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-document-grn-pending"></a>

#### `document.grn-pending` — Good Received Note pending

- **ชื่อไทย:** ใบรับสินค้าที่รอดำเนินการ
- **คำอธิบาย:** Good Received Note documents awaiting action, with ≥7-day aging
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-document-po-by-status"></a>

#### `document.po-by-status` — Purchase Order by status

- **ชื่อไทย:** ใบสั่งซื้อแยกตามสถานะ
- **คำอธิบาย:** Purchase Order documents grouped by status over the selected time range
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-document-po-count"></a>

#### `document.po-count` — Purchase Order count

- **ชื่อไทย:** จำนวนใบสั่งซื้อ
- **คำอธิบาย:** Number of Purchase Order documents in the selected time range, optional status filter
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |
  | `status` | Status | text | `draft` `in_progress` `sent` `partial` `closed` `completed` `voided` | — | — |

<a id="ds-document-po-created-series"></a>

#### `document.po-created-series` — Purchase Order created (series)

- **ชื่อไทย:** ใบสั่งซื้อที่สร้าง (ซีรีส์)
- **คำอธิบาย:** Purchase Order documents created per day over the selected time range
- **shape:** `time_series` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `line` `area` `bar` `sparkline`
- **FE วาดได้จริง:** `bar` `line` `area`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-document-po-pending"></a>

#### `document.po-pending` — Purchase Order pending

- **ชื่อไทย:** ใบสั่งซื้อที่รอดำเนินการ
- **คำอธิบาย:** Purchase Order documents awaiting action, with ≥7-day aging
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-document-po-rejected"></a>

#### `document.po-rejected` — Rejected POs

- **ชื่อไทย:** ใบสั่งซื้อที่ถูกปฏิเสธ
- **คำอธิบาย:** Purchase Order items rejected — item name, date, who acted, and reason
- **shape:** `table` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `table`
- **FE วาดได้จริง:** `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |
  | `limit` | Rows | text | `3` `5` `10` | 5 | — |

<a id="ds-document-po-sent-back"></a>

#### `document.po-sent-back` — Sent Back POs

- **ชื่อไทย:** ใบสั่งซื้อที่ถูกส่งกลับ
- **คำอธิบาย:** Purchase Order items sent back for review — item name, date, who acted, and reason
- **shape:** `table` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `table`
- **FE วาดได้จริง:** `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |
  | `limit` | Rows | text | `3` `5` `10` | 5 | — |

<a id="ds-document-pr-by-status"></a>

#### `document.pr-by-status` — Purchase Request by status

- **ชื่อไทย:** ใบขอซื้อแยกตามสถานะ
- **คำอธิบาย:** Purchase Request documents grouped by status over the selected time range
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-document-pr-count"></a>

#### `document.pr-count` — Purchase Request count

- **ชื่อไทย:** จำนวนใบขอซื้อ
- **คำอธิบาย:** Number of Purchase Request documents in the selected time range, optional status filter
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |
  | `status` | Status | text | `draft` `in_progress` `approved` `completed` `voided` | — | — |

<a id="ds-document-pr-created-series"></a>

#### `document.pr-created-series` — Purchase Request created (series)

- **ชื่อไทย:** ใบขอซื้อที่สร้าง (ซีรีส์)
- **คำอธิบาย:** Purchase Request documents created per day over the selected time range
- **shape:** `time_series` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `line` `area` `bar` `sparkline`
- **FE วาดได้จริง:** `bar` `line` `area`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-document-pr-pending"></a>

#### `document.pr-pending` — Purchase Request pending

- **ชื่อไทย:** ใบขอซื้อที่รอดำเนินการ
- **คำอธิบาย:** Purchase Request documents awaiting action, with ≥7-day aging
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-document-pr-rejected"></a>

#### `document.pr-rejected` — Rejected PRs

- **ชื่อไทย:** ใบขอซื้อที่ถูกปฏิเสธ
- **คำอธิบาย:** Purchase Request items rejected — item name, date, who acted, and reason
- **shape:** `table` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `table`
- **FE วาดได้จริง:** `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |
  | `limit` | Rows | text | `3` `5` `10` | 5 | — |

<a id="ds-document-pr-sent-back"></a>

#### `document.pr-sent-back` — Sent Back PRs

- **ชื่อไทย:** ใบขอซื้อที่ถูกส่งกลับ
- **คำอธิบาย:** Purchase Request items sent back for review — item name, date, who acted, and reason
- **shape:** `table` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `table`
- **FE วาดได้จริง:** `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |
  | `limit` | Rows | text | `3` `5` `10` | 5 | — |

<a id="ds-document-pr-table"></a>

#### `document.pr-table` — Purchase Request table

- **ชื่อไทย:** ตารางใบขอซื้อ
- **คำอธิบาย:** Recent Purchase Requests (date, status, department, amount) over the selected time range
- **shape:** `table` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `table`
- **FE วาดได้จริง:** `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-document-sr-by-status"></a>

#### `document.sr-by-status` — Store Requisition by status

- **ชื่อไทย:** ใบเบิกสินค้าแยกตามสถานะ
- **คำอธิบาย:** Store Requisition documents grouped by status over the selected time range
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-document-sr-count"></a>

#### `document.sr-count` — Store Requisition count

- **ชื่อไทย:** จำนวนใบเบิกสินค้า
- **คำอธิบาย:** Number of Store Requisition documents in the selected time range, optional status filter
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |
  | `status` | Status | text | `draft` `in_progress` `completed` `cancelled` `voided` | — | — |

<a id="ds-document-sr-created-series"></a>

#### `document.sr-created-series` — Store Requisition created (series)

- **ชื่อไทย:** ใบเบิกสินค้าที่สร้าง (ซีรีส์)
- **คำอธิบาย:** Store Requisition documents created per day over the selected time range
- **shape:** `time_series` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `line` `area` `bar` `sparkline`
- **FE วาดได้จริง:** `bar` `line` `area`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-document-sr-issued"></a>

#### `document.sr-issued` — Store Requisition issued

- **ชื่อไทย:** ใบเบิกสินค้าที่จ่ายแล้ว
- **คำอธิบาย:** Store Requisitions issued to the requesting location in the selected time range
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-document-sr-pending"></a>

#### `document.sr-pending` — Store Requisition pending

- **ชื่อไทย:** ใบเบิกสินค้าที่รอดำเนินการ
- **คำอธิบาย:** Store Requisition documents awaiting action, with ≥7-day aging
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-document-sr-rejected"></a>

#### `document.sr-rejected` — Rejected SRs

- **ชื่อไทย:** ใบเบิกสินค้าที่ถูกปฏิเสธ
- **คำอธิบาย:** Store Requisition items rejected — item name, date, who acted, and reason
- **shape:** `table` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `table`
- **FE วาดได้จริง:** `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |
  | `limit` | Rows | text | `3` `5` `10` | 5 | — |

<a id="ds-document-sr-sent-back"></a>

#### `document.sr-sent-back` — Sent Back SRs

- **ชื่อไทย:** ใบเบิกสินค้าที่ถูกส่งกลับ
- **คำอธิบาย:** Store Requisition items sent back for review — item name, date, who acted, and reason
- **shape:** `table` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `table`
- **FE วาดได้จริง:** `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |
  | `limit` | Rows | text | `3` `5` `10` | 5 | — |

<a id="ds-group-equipment"></a>

### equipment

<a id="ds-equipment-by-category"></a>

#### `equipment.by-category` — Equipment by category

- **ชื่อไทย:** อุปกรณ์แยกตามหมวดหมู่
- **คำอธิบาย:** Active equipment grouped by equipment category
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:** ไม่มี

<a id="ds-equipment-total-active"></a>

#### `equipment.total-active` — Active equipment

- **ชื่อไทย:** อุปกรณ์ที่ใช้งาน
- **คำอธิบาย:** Total recipe equipment marked is_active
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-group-inventory"></a>

### inventory

<a id="ds-inventory-below-par-by-location"></a>

#### `inventory.below-par-by-location` — Below par by location

- **ชื่อไทย:** สินค้าต่ำกว่า par แยกตามสถานที่
- **คำอธิบาย:** Locations ranked by how many of their products need replenishment
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` `20` | 10 | — |

<a id="ds-inventory-below-par-count"></a>

#### `inventory.below-par-count` — Items below par

- **ชื่อไทย:** สินค้าที่ต่ำกว่า par
- **คำอธิบาย:** Product/location pairs whose on-hand quantity has fallen below their configured par level
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-inventory-below-par-items"></a>

#### `inventory.below-par-items` — Replenishment list

- **ชื่อไทย:** รายการที่ต้องเติมสต๊อก
- **คำอธิบาย:** Items to restock — product, location, on hand, the configured min/max/par, and the quantity to order
- **shape:** `table` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `table`
- **FE วาดได้จริง:** `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` `20` | 10 | — |

<a id="ds-inventory-issue-by-priority"></a>

#### `inventory.issue-by-priority` — Issues by priority

- **ชื่อไทย:** ปัญหาแยกตามความสำคัญ
- **คำอธิบาย:** Open & resolved issues grouped by priority level
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |

<a id="ds-inventory-issue-open"></a>

#### `inventory.issue-open` — Open issues

- **ชื่อไทย:** ปัญหาที่ยังเปิดอยู่
- **คำอธิบาย:** Issue tickets not yet resolved or closed
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |
  | `aging_days` | Aged at least (days) | text | `3` `7` `14` `30` | 7 | — |

<a id="ds-inventory-low-stock-count"></a>

#### `inventory.low-stock-count` — Low stock items

- **ชื่อไทย:** สินค้าใกล้หมด
- **คำอธิบาย:** Product/location pairs configured with a reorder threshold (proxy)
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-inventory-most-active-products"></a>

#### `inventory.most-active-products` — Most active products (inventory)

- **ชื่อไทย:** สินค้าที่เคลื่อนไหวมากที่สุด (สต๊อก)
- **คำอธิบาย:** Products ranked by inventory transaction count, capped by the selected row count
- **shape:** `ranked` · **หน่วย:** transactions · **หมวด:** movement
- **backend รองรับ:** `bar` `table`
- **FE วาดได้จริง:** `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` `20` | 10 | — |

<a id="ds-inventory-physical-count-by-status"></a>

#### `inventory.physical-count-by-status` — Physical count by status

- **ชื่อไทย:** ตรวจนับสินค้าแยกตามสถานะ
- **คำอธิบาย:** Physical count sessions grouped by workflow status
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |

<a id="ds-inventory-physical-count-pending"></a>

#### `inventory.physical-count-pending` — Pending physical counts

- **ชื่อไทย:** ตรวจนับสินค้าที่ค้างอยู่
- **คำอธิบาย:** Physical count sessions not yet completed
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |
  | `aging_days` | Aged at least (days) | text | `3` `7` `14` `30` | 7 | — |

<a id="ds-inventory-slow-moving"></a>

#### `inventory.slow-moving` — Slow moving items ⚠️ ไม่มีชื่อไทย

- **ชื่อไทย:** —
- **คำอธิบาย:** Stock on hand that has not moved for the chosen number of days — location, product, last movement and value, largest value first
- **shape:** `table` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `table`
- **FE วาดได้จริง:** `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `days` | No movement for (days) | text | `30` `60` `90` `180` | 30 | — |
  | `limit` | Rows | text | `10` `20` `50` `100` | 20 | — |

<a id="ds-inventory-spot-check-by-status"></a>

#### `inventory.spot-check-by-status` — Spot Check by status

- **ชื่อไทย:** ตรวจสอบเฉพาะจุดแยกตามสถานะ
- **คำอธิบาย:** Distribution of Spot Check sessions across statuses
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |

<a id="ds-inventory-spot-check-pending"></a>

#### `inventory.spot-check-pending` — Pending Spot Checks

- **ชื่อไทย:** ตรวจสอบเฉพาะจุดที่ค้างอยู่
- **คำอธิบาย:** Spot check sessions not yet completed (pending or in_progress)
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |
  | `aging_days` | Aged at least (days) | text | `3` `7` `14` `30` | 7 | — |

<a id="ds-inventory-stock-in-by-status"></a>

#### `inventory.stock-in-by-status` — Stock In by status

- **ชื่อไทย:** Stock In แยกตามสถานะ
- **คำอธิบาย:** Distribution of Stock In documents across statuses
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |

<a id="ds-inventory-stock-in-pending"></a>

#### `inventory.stock-in-pending` — Pending Stock In

- **ชื่อไทย:** Stock In ที่ค้างอยู่
- **คำอธิบาย:** Stock In documents currently in_progress
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |
  | `aging_days` | Aged at least (days) | text | `3` `7` `14` `30` | 7 | — |

<a id="ds-inventory-stock-out-by-status"></a>

#### `inventory.stock-out-by-status` — Stock Out by status

- **ชื่อไทย:** Stock Out แยกตามสถานะ
- **คำอธิบาย:** Distribution of Stock Out documents across statuses
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |

<a id="ds-inventory-stock-out-pending"></a>

#### `inventory.stock-out-pending` — Pending Stock Out

- **ชื่อไทย:** Stock Out ที่ค้างอยู่
- **คำอธิบาย:** Stock Out documents currently in_progress
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |
  | `aging_days` | Aged at least (days) | text | `3` `7` `14` `30` | 7 | — |

<a id="ds-inventory-transactions-by-location-month"></a>

#### `inventory.transactions-by-location-month` — Inventory tx by location × month ⚠️ วาดไม่ได้ใน FE

- **ชื่อไทย:** รายการสต๊อกแยกตามสถานที่ × เดือน
- **คำอธิบาย:** Top 10 locations × last 6 months heatmap of transaction count
- **shape:** `matrix` · **หน่วย:** transactions · **หมวด:** movement
- **backend รองรับ:** `heatmap` `table`
- **FE วาดได้จริง:** —
- **ตัวแปร:** ไม่มี

<a id="ds-inventory-transactions-daily"></a>

#### `inventory.transactions-daily` — Inventory transactions (daily)

- **ชื่อไทย:** รายการเคลื่อนไหวสต๊อก (รายวัน)
- **คำอธิบาย:** Number of inventory transactions per day, over the selected range (source view holds 30 days)
- **shape:** `time_series` · **หน่วย:** items · **หมวด:** movement
- **backend รองรับ:** `line` `area` `bar` `sparkline`
- **FE วาดได้จริง:** `bar` `line` `area`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-group-pricelist"></a>

### pricelist

<a id="ds-pricelist-active-count"></a>

#### `pricelist.active-count` — Active pricelists

- **ชื่อไทย:** รายการราคาที่ใช้งาน
- **คำอธิบาย:** Pricelists currently in status = active
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** spend
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-pricelist-by-status"></a>

#### `pricelist.by-status` — Pricelists by status

- **ชื่อไทย:** รายการราคาแยกตามสถานะ
- **คำอธิบาย:** Distribution across draft / active / inactive / expired
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** spend
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:** ไม่มี

<a id="ds-pricelist-by-vendor-top"></a>

#### `pricelist.by-vendor-top` — Pricelists by vendor (top N)

- **ชื่อไทย:** รายการราคาแยกตาม vendor (Top N)
- **คำอธิบาย:** Vendors ranked by number of active pricelists (source view holds 10)
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** spend
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` | 10 | — |

<a id="ds-pricelist-expiring-soon"></a>

#### `pricelist.expiring-soon` — Pricelists expiring (≤30d)

- **ชื่อไทย:** รายการราคาใกล้หมดอายุ (≤30 วัน)
- **คำอธิบาย:** Active pricelists with effective_to_date within 30 days
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** spend
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `expiry_within` | Expiring within | text | `@7days` `@30days` `@90days` | @30days | — |

<a id="ds-group-procurement"></a>

### procurement

<a id="ds-procurement-po-by-vendor-top"></a>

#### `procurement.po-by-vendor-top` — Top vendors by PO spend

- **ชื่อไทย:** Vendor ที่มียอดสั่งซื้อสูงสุด
- **คำอธิบาย:** Vendors ranked by total PO amount (current period), capped by the selected row count
- **shape:** `categorical` · **หน่วย:** ฿ · **หมวด:** spend
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` `20` | 10 | — |

<a id="ds-procurement-pr-by-department"></a>

#### `procurement.pr-by-department` — PR by department

- **ชื่อไทย:** ใบขอซื้อแยกตามแผนก
- **คำอธิบาย:** Purchase request volume per requesting department, over the selected range (defaults to all time)
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |

<a id="ds-procurement-pr-by-status"></a>

#### `procurement.pr-by-status` — PR by status

- **ชื่อไทย:** ใบขอซื้อแยกตามสถานะ
- **คำอธิบาย:** Distribution of Purchase Requests across workflow statuses, over the selected range (defaults to all time)
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |

<a id="ds-procurement-slowest-po-approvals"></a>

#### `procurement.slowest-po-approvals` — Slowest PO approvals

- **ชื่อไทย:** ใบสั่งซื้อที่อนุมัติช้าที่สุด
- **คำอธิบาย:** Purchase orders pending longest in the approval workflow (source view holds 10)
- **shape:** `ranked` · **หน่วย:** days · **หมวด:** workflow
- **backend รองรับ:** `bar` `table`
- **FE วาดได้จริง:** `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` | 10 | — |

<a id="ds-procurement-slowest-pr-approvals"></a>

#### `procurement.slowest-pr-approvals` — Slowest PR approvals

- **ชื่อไทย:** ใบขอซื้อที่อนุมัติช้าที่สุด
- **คำอธิบาย:** Purchase requests pending longest in the approval workflow (source view holds 10)
- **shape:** `ranked` · **หน่วย:** days · **หมวด:** workflow
- **backend รองรับ:** `bar` `table`
- **FE วาดได้จริง:** `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` | 10 | — |

<a id="ds-procurement-spend-by-vendor-month"></a>

#### `procurement.spend-by-vendor-month` — Spend by vendor × month ⚠️ วาดไม่ได้ใน FE

- **ชื่อไทย:** ยอดสั่งซื้อแยกตาม vendor × เดือน
- **คำอธิบาย:** Top 10 vendors × last 6 months heatmap of total PO spend
- **shape:** `matrix` · **หน่วย:** ฿ · **หมวด:** spend
- **backend รองรับ:** `heatmap` `table`
- **FE วาดได้จริง:** —
- **ตัวแปร:** ไม่มี

<a id="ds-procurement-spend-daily"></a>

#### `procurement.spend-daily` — PO spend (daily)

- **ชื่อไทย:** ยอดสั่งซื้อ (รายวัน)
- **คำอธิบาย:** Sum of PO total_amount per day in base currency, over the selected range (source view holds 30 days)
- **shape:** `time_series` · **หน่วย:** ฿ · **หมวด:** spend
- **backend รองรับ:** `line` `area` `bar` `sparkline`
- **FE วาดได้จริง:** `bar` `line` `area`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-procurement-top-products-by-quantity"></a>

#### `procurement.top-products-by-quantity` — Top products by PR quantity

- **ชื่อไทย:** สินค้าที่ขอซื้อมากที่สุด
- **คำอธิบาย:** Products ranked by total requested quantity across all PRs, capped by the selected row count
- **shape:** `ranked` · **หน่วย:** qty · **หมวด:** spend
- **backend รองรับ:** `bar` `table`
- **FE วาดได้จริง:** `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` `20` | 10 | — |

<a id="ds-group-product"></a>

### product

<a id="ds-product-added-7d"></a>

#### `product.added-7d` — Products added (7d)

- **ชื่อไทย:** สินค้าที่เพิ่ม (7 วัน)
- **คำอธิบาย:** New products this week vs previous week
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@3days` `@7days` `@1month` | @7days | — |

<a id="ds-product-added-daily"></a>

#### `product.added-daily` — Products added (daily)

- **ชื่อไทย:** สินค้าที่เพิ่ม (รายวัน)
- **คำอธิบาย:** New products created per day over the selected range (source view holds 30 days)
- **shape:** `time_series` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `line` `area` `bar` `sparkline`
- **FE วาดได้จริง:** `bar` `line` `area`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-product-by-category-top"></a>

#### `product.by-category-top` — Products by category (top N)

- **ชื่อไทย:** สินค้าแยกตามหมวดหมู่ (Top N)
- **คำอธิบาย:** Top-level categories ranked by product count, capped by the selected row count
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` `20` | 10 | — |

<a id="ds-product-by-item-group-top"></a>

#### `product.by-item-group-top` — Products by item group (top N)

- **ชื่อไทย:** สินค้าแยกตามกลุ่มสินค้า (Top N)
- **คำอธิบาย:** Item groups ranked by product count, capped by the selected row count
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` `20` | 10 | — |

<a id="ds-product-by-status"></a>

#### `product.by-status` — Products by status

- **ชื่อไทย:** สินค้าแยกตามสถานะ
- **คำอธิบาย:** Active / inactive / discontinued breakdown
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:** ไม่มี

<a id="ds-product-by-unit"></a>

#### `product.by-unit` — Products by inventory unit

- **ชื่อไทย:** สินค้าแยกตามหน่วยสต๊อก
- **คำอธิบาย:** How products are distributed across inventory units
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:** ไม่มี

<a id="ds-product-category-total"></a>

#### `product.category-total` — Product categories

- **ชื่อไทย:** หมวดหมู่สินค้า
- **คำอธิบาย:** Total active product categories
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-product-top-vendors-by-product-count"></a>

#### `product.top-vendors-by-product-count` — Top vendors by product coverage

- **ชื่อไทย:** Vendor ที่ครอบคลุมสินค้ามากที่สุด
- **คำอธิบาย:** Vendors ranked by number of products they supply, capped by the selected row count
- **shape:** `ranked` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `table`
- **FE วาดได้จริง:** `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` `20` | 10 | — |

<a id="ds-product-total-active"></a>

#### `product.total-active` — Active products

- **ชื่อไทย:** สินค้าที่ใช้งาน
- **คำอธิบาย:** Total products with status = active
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-product-total-inactive"></a>

#### `product.total-inactive` — Inactive products

- **ชื่อไทย:** สินค้าที่ไม่ใช้งาน
- **คำอธิบาย:** Products marked inactive or discontinued
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-product-updated-daily"></a>

#### `product.updated-daily` — Products updated (daily)

- **ชื่อไทย:** สินค้าที่แก้ไข (รายวัน)
- **คำอธิบาย:** Distinct products modified per day over the selected range (source view holds 30 days)
- **shape:** `time_series` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `line` `area` `bar` `sparkline`
- **FE วาดได้จริง:** `bar` `line` `area`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-product-without-vendor"></a>

#### `product.without-vendor` — Products without vendor

- **ชื่อไทย:** สินค้าที่ไม่มี vendor
- **คำอธิบาย:** Active products with no linked vendor (catalog gap)
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-group-recipe"></a>

### recipe

<a id="ds-recipe-added-7d"></a>

#### `recipe.added-7d` — Recipes added (7d)

- **ชื่อไทย:** สูตรอาหารที่เพิ่ม (7 วัน)
- **คำอธิบาย:** New recipes this week vs previous week
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@3days` `@7days` `@1month` | @7days | — |

<a id="ds-recipe-added-daily"></a>

#### `recipe.added-daily` — Recipes added (daily)

- **ชื่อไทย:** สูตรอาหารที่เพิ่ม (รายวัน)
- **คำอธิบาย:** New recipes created per day over the selected range (source view holds 30 days)
- **shape:** `time_series` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `line` `area` `bar` `sparkline`
- **FE วาดได้จริง:** `bar` `line` `area`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-recipe-average-ingredients"></a>

#### `recipe.average-ingredients` — Avg ingredients per recipe

- **ชื่อไทย:** วัตถุดิบเฉลี่ยต่อสูตร
- **คำอธิบาย:** Average ingredient count across active recipes
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-recipe-by-category-top"></a>

#### `recipe.by-category-top` — Recipes by category (top N)

- **ชื่อไทย:** สูตรอาหารแยกตามหมวดหมู่ (Top N)
- **คำอธิบาย:** Recipe categories ranked by recipe count, capped by the selected row count
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` `20` | 10 | — |

<a id="ds-recipe-by-cuisine-top"></a>

#### `recipe.by-cuisine-top` — Recipes by cuisine (top N)

- **ชื่อไทย:** สูตรอาหารแยกตามประเภทอาหาร (Top N)
- **คำอธิบาย:** Cuisines ranked by recipe count, capped by the selected row count
- **shape:** `categorical` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `pie` `table`
- **FE วาดได้จริง:** `pie` `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` `20` | 10 | — |

<a id="ds-recipe-cuisines-total"></a>

#### `recipe.cuisines-total` — Cuisine types

- **ชื่อไทย:** ประเภทอาหาร
- **คำอธิบาย:** Total active cuisine types
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-recipe-most-complex"></a>

#### `recipe.most-complex` — Most complex recipes

- **ชื่อไทย:** สูตรอาหารที่ซับซ้อนที่สุด
- **คำอธิบาย:** Active recipes ranked by ingredient count, capped by the selected row count
- **shape:** `ranked` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `bar` `table`
- **FE วาดได้จริง:** `bar` `table`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `limit` | Rows | text | `5` `10` `20` | 10 | — |

<a id="ds-recipe-total-active"></a>

#### `recipe.total-active` — Active recipes

- **ชื่อไทย:** สูตรอาหารที่ใช้งาน
- **คำอธิบาย:** Total recipes flagged is_active
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** inventory
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-group-rfp"></a>

### rfp

<a id="ds-rfp-active"></a>

#### `rfp.active` — Active RFPs

- **ชื่อไทย:** RFP ที่เปิดอยู่
- **คำอธิบาย:** Request-for-pricing forms currently open to vendors
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** spend
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-rfp-issued-daily"></a>

#### `rfp.issued-daily` — RFPs issued (daily)

- **ชื่อไทย:** RFP ที่ออก (รายวัน)
- **คำอธิบาย:** Number of RFPs created per day over the selected range (source view holds 30 days)
- **shape:** `time_series` · **หน่วย:** items · **หมวด:** spend
- **backend รองรับ:** `line` `area` `bar` `sparkline`
- **FE วาดได้จริง:** `bar` `line` `area`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@today` `@3days` `@7days` `@1month` | @1month | — |

<a id="ds-rfp-upcoming-7d"></a>

#### `rfp.upcoming-7d` — Upcoming RFPs (7d)

- **ชื่อไทย:** RFP ที่จะเปิด (7 วัน)
- **คำอธิบาย:** RFPs starting within the next 7 days
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** spend
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `starts_within` | Starting within | text | `@7days` `@14days` `@30days` | @7days | — |

<a id="ds-group-vendor"></a>

### vendor

<a id="ds-vendor-added-7d"></a>

#### `vendor.added-7d` — Vendors added (7d)

- **ชื่อไทย:** Vendor ที่เพิ่ม (7 วัน)
- **คำอธิบาย:** New vendors this week vs previous week
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** spend
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@3days` `@7days` `@1month` | @7days | — |

<a id="ds-vendor-total-active"></a>

#### `vendor.total-active` — Active vendors

- **ชื่อไทย:** Vendor ที่ใช้งาน
- **คำอธิบาย:** Total vendors flagged is_active
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** spend
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-vendor-without-products"></a>

#### `vendor.without-products` — Vendors without products

- **ชื่อไทย:** Vendor ที่ไม่มีสินค้า
- **คำอธิบาย:** Active vendors not linked to any product (catalog gap)
- **shape:** `scalar` · **หน่วย:** items · **หมวด:** spend
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:** ไม่มี

<a id="ds-group-workflow"></a>

### workflow

<a id="ds-workflow-cn-pending-approval"></a>

#### `workflow.cn-pending-approval` — Pending CN approvals

- **ชื่อไทย:** ใบลดหนี้รออนุมัติ
- **คำอธิบาย:** Credit notes currently in the approval workflow
- **shape:** `scalar_delta` · **หน่วย:** items · **หมวด:** workflow
- **backend รองรับ:** `kpi` `gauge`
- **FE วาดได้จริง:** `kpi` `gauge`
- **ตัวแปร:**

  | name | label | type | ค่าที่เลือกได้ | default | บังคับ |
  | --- | --- | --- | --- | --- | --- |
  | `time_range` | Time range | text | `@all` `@today` `@3days` `@7days` `@1month` | @all | — |
  | `aging_days` | Aged at least (days) | text | `3` `7` `14` `30` | 7 | — |

<a id="ds-workflow-my-pending-pr"></a>

#### `workflow.my-pending-pr` — My pending PRs

- **ชื่อไทย:** ใบขอซื้อที่รอฉันดำเนินการ
- **คำอธิบาย:** Purchase requests I submitted that are still in the approval workflow
- **shape:** `ranked` · **หน่วย:** days · **หมวด:** workflow
- **backend รองรับ:** `bar` `table`
- **FE วาดได้จริง:** `bar` `table`
- **ตัวแปร:** ไม่มี

## 2. widget สำเร็จรูป

### หน้า dashboard ของแต่ละ module (`system`)

#### procurement

| ลำดับ | ชื่อ | dataset | widget_type | params | display | allow BU | deny BU | active |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | PR รออนุมัติ | [`document.pr-pending`](#ds-document-pr-pending) | `kpi` | — | — | — | — | เปิด |
| 20 | PO รออนุมัติ | [`document.po-pending`](#ds-document-po-pending) | `kpi` | — | — | — | — | เปิด |
| 30 | GRN รอ commit | [`document.grn-pending`](#ds-document-grn-pending) | `kpi` | — | — | — | — | เปิด |
| 40 | CN รออนุมัติ | [`workflow.cn-pending-approval`](#ds-workflow-cn-pending-approval) | `kpi` | — | — | — | — | เปิด |
| 50 | PR แยกตามสถานะ | [`procurement.pr-by-status`](#ds-procurement-pr-by-status) | `pie` | — | — | — | — | เปิด |
| 60 | PO แยกตามสถานะ | [`document.po-by-status`](#ds-document-po-by-status) | `pie` | — | — | — | — | เปิด |
| 70 | Top 10 vendor ตามยอดสั่ง | [`procurement.po-by-vendor-top`](#ds-procurement-po-by-vendor-top) | `bar` | — | — | — | — | เปิด |
| 80 | PR แยกตามแผนก | [`procurement.pr-by-department`](#ds-procurement-pr-by-department) | `bar` | — | — | — | — | เปิด |

#### inventory

| ลำดับ | ชื่อ | dataset | widget_type | params | display | allow BU | deny BU | active |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Physical Count ค้าง | [`inventory.physical-count-pending`](#ds-inventory-physical-count-pending) | `kpi` | — | — | — | — | เปิด |
| 1 | Low Stock | [`inventory.low-stock-count`](#ds-inventory-low-stock-count) | `kpi` | — | — | — | — | เปิด |
| 2 | Stock In ค้าง | [`inventory.stock-in-pending`](#ds-inventory-stock-in-pending) | `kpi` | — | — | — | — | เปิด |
| 3 | Stock Out ค้าง | [`inventory.stock-out-pending`](#ds-inventory-stock-out-pending) | `kpi` | — | — | — | — | เปิด |
| 4 | SR ค้าง | [`document.sr-pending`](#ds-document-sr-pending) | `kpi` | — | — | — | — | เปิด |
| 5 | Spot Check ค้าง | [`inventory.spot-check-pending`](#ds-inventory-spot-check-pending) | `kpi` | — | — | — | — | เปิด |
| 6 | Issues เปิดอยู่ | [`inventory.issue-open`](#ds-inventory-issue-open) | `kpi` | — | — | — | — | เปิด |
| 7 | Stock In แยกตามสถานะ | [`inventory.stock-in-by-status`](#ds-inventory-stock-in-by-status) | `pie` | — | — | — | — | เปิด |
| 8 | Stock Out แยกตามสถานะ | [`inventory.stock-out-by-status`](#ds-inventory-stock-out-by-status) | `pie` | — | — | — | — | เปิด |
| 9 | Spot Check แยกตามสถานะ | [`inventory.spot-check-by-status`](#ds-inventory-spot-check-by-status) | `pie` | — | — | — | — | เปิด |
| 10 | Issues แยกตามความสำคัญ | [`inventory.issue-by-priority`](#ds-inventory-issue-by-priority) | `bar` | — | — | — | — | เปิด |

#### product

| ลำดับ | ชื่อ | dataset | widget_type | params | display | allow BU | deny BU | active |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Product Active | [`product.total-active`](#ds-product-total-active) | `kpi` | — | — | — | — | เปิด |
| 1 | Product Inactive / Discontinued | [`product.total-inactive`](#ds-product-total-inactive) | `kpi` | — | — | — | — | เปิด |
| 2 | Product เพิ่มใน 7 วัน | [`product.added-7d`](#ds-product-added-7d) | `kpi` | — | — | — | — | เปิด |
| 3 | Product ไม่มี vendor | [`product.without-vendor`](#ds-product-without-vendor) | `kpi` | — | — | — | — | เปิด |
| 4 | Category ทั้งหมด | [`product.category-total`](#ds-product-category-total) | `kpi` | — | — | — | — | เปิด |
| 5 | Product แยกตามสถานะ | [`product.by-status`](#ds-product-by-status) | `pie` | — | — | — | — | เปิด |
| 6 | Top 10 category ตามจำนวน product | [`product.by-category-top`](#ds-product-by-category-top) | `bar` | — | — | — | — | เปิด |
| 7 | Top 10 item group | [`product.by-item-group-top`](#ds-product-by-item-group-top) | `bar` | — | — | — | — | เปิด |
| 8 | Product แยกตาม inventory unit | [`product.by-unit`](#ds-product-by-unit) | `pie` | — | — | — | — | เปิด |
| 9 | Top 10 vendor ตามจำนวน product | [`product.top-vendors-by-product-count`](#ds-product-top-vendors-by-product-count) | `bar` | — | — | — | — | เปิด |
| 10 | Product เพิ่มต่อวัน (30d) | [`product.added-daily`](#ds-product-added-daily) | `line` | — | — | — | — | เปิด |
| 11 | Product อัปเดตต่อวัน (30d) | [`product.updated-daily`](#ds-product-updated-daily) | `line` | — | — | — | — | เปิด |

#### config

| ลำดับ | ชื่อ | dataset | widget_type | params | display | allow BU | deny BU | active |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Active locations | [`config.location-active-count`](#ds-config-location-active-count) | `kpi` | — | — | — | — | เปิด |
| 1 | Vendor แยกตามประเภทธุรกิจ | [`config.vendor-by-business-type`](#ds-config-vendor-by-business-type) | `bar` | — | — | — | — | เปิด |
| 2 | CN แยกตามเหตุผล | [`config.cn-by-reason`](#ds-config-cn-by-reason) | `bar` | — | — | — | — | เปิด |
| 3 | Tax profile แยกตาม rate (%) | [`config.tax-profile-by-rate`](#ds-config-tax-profile-by-rate) | `bar` | — | — | — | — | เปิด |
| 4 | Exchange rate ล่าสุดต่อสกุล | [`config.exchange-rate-latest`](#ds-config-exchange-rate-latest) | `bar` | — | — | — | — | เปิด |

#### vendor-management

| ลำดับ | ชื่อ | dataset | widget_type | params | display | allow BU | deny BU | active |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Vendor active | [`vendor.total-active`](#ds-vendor-total-active) | `kpi` | — | — | — | — | เปิด |
| 1 | Vendor เพิ่มใน 7 วัน | [`vendor.added-7d`](#ds-vendor-added-7d) | `kpi` | — | — | — | — | เปิด |
| 2 | Vendor ไม่มี product | [`vendor.without-products`](#ds-vendor-without-products) | `kpi` | — | — | — | — | เปิด |
| 3 | Pricelist active | [`pricelist.active-count`](#ds-pricelist-active-count) | `kpi` | — | — | — | — | เปิด |
| 4 | Pricelist ใกล้หมดอายุ (30d) | [`pricelist.expiring-soon`](#ds-pricelist-expiring-soon) | `kpi` | — | — | — | — | เปิด |
| 5 | RFP เปิดอยู่ | [`rfp.active`](#ds-rfp-active) | `kpi` | — | — | — | — | เปิด |
| 6 | RFP จะเปิดใน 7 วัน | [`rfp.upcoming-7d`](#ds-rfp-upcoming-7d) | `kpi` | — | — | — | — | เปิด |
| 7 | Pricelist แยกตามสถานะ | [`pricelist.by-status`](#ds-pricelist-by-status) | `pie` | — | — | — | — | เปิด |
| 8 | Top 10 vendor ตามจำนวน pricelist | [`pricelist.by-vendor-top`](#ds-pricelist-by-vendor-top) | `bar` | — | — | — | — | เปิด |
| 9 | RFP สร้างต่อวัน (30d) | [`rfp.issued-daily`](#ds-rfp-issued-daily) | `line` | — | — | — | — | เปิด |

#### operation-plan

| ลำดับ | ชื่อ | dataset | widget_type | params | display | allow BU | deny BU | active |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Recipe active | [`recipe.total-active`](#ds-recipe-total-active) | `kpi` | — | — | — | — | เปิด |
| 1 | Recipe เพิ่มใน 7 วัน | [`recipe.added-7d`](#ds-recipe-added-7d) | `kpi` | — | — | — | — | เปิด |
| 2 | Avg ingredients / recipe | [`recipe.average-ingredients`](#ds-recipe-average-ingredients) | `kpi` | — | — | — | — | เปิด |
| 3 | Cuisine types | [`recipe.cuisines-total`](#ds-recipe-cuisines-total) | `kpi` | — | — | — | — | เปิด |
| 4 | Equipment active | [`equipment.total-active`](#ds-equipment-total-active) | `kpi` | — | — | — | — | เปิด |
| 5 | Top 10 cuisine ตามจำนวน recipe | [`recipe.by-cuisine-top`](#ds-recipe-by-cuisine-top) | `bar` | — | — | — | — | เปิด |
| 6 | Top 10 recipe category | [`recipe.by-category-top`](#ds-recipe-by-category-top) | `bar` | — | — | — | — | เปิด |
| 7 | Equipment แยกตามประเภท | [`equipment.by-category`](#ds-equipment-by-category) | `pie` | — | — | — | — | เปิด |
| 8 | Recipe ที่ใช้ ingredients มากสุด | [`recipe.most-complex`](#ds-recipe-most-complex) | `bar` | — | — | — | — | เปิด |
| 9 | Recipe สร้างต่อวัน (30d) | [`recipe.added-daily`](#ds-recipe-added-daily) | `line` | — | — | — | — | เปิด |

#### store-operation

| ลำดับ | ชื่อ | dataset | widget_type | params | display | allow BU | deny BU | active |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | SR รอดำเนินการ | [`document.sr-pending`](#ds-document-sr-pending) | `kpi` | — | — | — | — | เปิด |
| 1 | SR ทั้งหมด | [`document.sr-count`](#ds-document-sr-count) | `kpi` | — | — | — | — | เปิด |
| 2 | สินค้าต่ำกว่า par | [`inventory.below-par-count`](#ds-inventory-below-par-count) | `kpi` | — | — | — | — | เปิด |
| 3 | SR แยกตามสถานะ | [`document.sr-by-status`](#ds-document-sr-by-status) | `pie` | — | — | — | — | เปิด |
| 4 | SR สร้างต่อวัน | [`document.sr-created-series`](#ds-document-sr-created-series) | `line` | — | — | — | — | เปิด |
| 5 | SR ที่จ่ายของแล้ว | [`document.sr-issued`](#ds-document-sr-issued) | `kpi` | — | — | — | — | เปิด |
| 6 | รายการที่ต้องเติมสต๊อก | [`inventory.below-par-items`](#ds-inventory-below-par-items) | `table` | — | — | — | — | เปิด |

### ชุดตั้งต้นของหน้า dashboard หลัก (`bu_default`)

ชุดที่ platform deploy ลง BU — หลัง deploy แล้ว BU แก้ของตัวเองต่อได้

| ลำดับ | ชื่อ | dataset | widget_type | params | display | allow BU | deny BU | active |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | PR รออนุมัติ | [`document.pr-pending`](#ds-document-pr-pending) | `kpi` | — | — | — | — | เปิด |
| 1 | PO รออนุมัติ | [`document.po-pending`](#ds-document-po-pending) | `kpi` | — | — | — | — | เปิด |
| 2 | GRN รอ commit | [`document.grn-pending`](#ds-document-grn-pending) | `kpi` | — | — | — | — | เปิด |
| 3 | SR รอดำเนินการ | [`document.sr-pending`](#ds-document-sr-pending) | `kpi` | — | — | — | — | เปิด |
| 4 | Low Stock | [`inventory.low-stock-count`](#ds-inventory-low-stock-count) | `kpi` | — | — | — | — | เปิด |
| 6 | PR แยกตามสถานะ | [`document.pr-by-status`](#ds-document-pr-by-status) | `pie` | — | — | — | — | เปิด |
| 7 | Top 10 vendor ตามยอดสั่ง | [`procurement.po-by-vendor-top`](#ds-procurement-po-by-vendor-top) | `bar` | — | — | — | — | เปิด |
| 10 | Products by category (top N) | [`product.by-category-top`](#ds-product-by-category-top) | `bar` | {"limit":"10"} | — | — | — | เปิด |

## 3. ภาคผนวก

### widget_type ↔ shape

| widget_type | shape ที่ FE วาดได้ |
| --- | --- |
| `kpi` | `scalar` `scalar_delta` |
| `gauge` | `scalar` `scalar_delta` |
| `pie` | `categorical` `ranked` |
| `bar` | `categorical` `ranked` `time_series` |
| `line` | `time_series` |
| `area` | `time_series` |
| `table` | `table` `categorical` `ranked` |

ยังไม่มีการ์ด: `sparkline` `heatmap` · shape `matrix` ยังไม่มี widget ไหนวาดได้
(ที่มา: `RENDERERS` ใน `components/dashboard-widget/render-support.ts`)

### รูปข้อมูลต่อ shape

| shape | ข้อมูลที่ได้ |
| --- | --- |
| `scalar` | `{ value }` |
| `scalar_delta` | `{ value, prev, change? }` — prev = ค่าเมื่อ ≥7 วันก่อน |
| `time_series` | `[{ date, value }]` |
| `categorical` | `[{ label, value, color? }]` |
| `ranked` | `[{ rank, label, value, extras? }]` |
| `matrix` | `{ rows, cols, values[][] }` |
| `table` | `{ columns: [{ key, label, type? }], rows }` — คอลัมน์ type `id` ใช้ทำลิงก์ ไม่แสดง |

(ที่มา: `types/dashboard-widget.ts`)

### display keys

| key | ความหมาย |
| --- | --- |
| `width` | ความกว้างเป็นคอลัมน์ของกริด 12 คอลัมน์ (3=¼ · 4=⅓ · 6=½ · 8=⅔ · 9=¾ · 12=เต็มแถว) ไม่ใส่ = ตามชนิดกราฟ |
| `height` | ความสูงเป็นจำนวนแถว (1 แถว = 4rem) เนื้อหาที่ล้นจะเลื่อนในกล่อง |
| `decimals` | ทศนิยมของตัวเลขบนการ์ด |
| `min` | ต้นสเกลของ gauge (default 0) |
| `max` | ปลายสเกลของ gauge — ไม่ใส่ = เดาจากค่าปัจจุบัน |
| `thresholds` | `[{ value, color }]` เปลี่ยนสีเมื่อค่าถึงขีด เรียงน้อยไปมาก (UI แก้ได้ตัวแรกตัวเดียว) |

`display` เป็น schema ของ FE — backend เก็บเป็น object ทึบ (≤ 8KB) ไม่ตีความ (ที่มา: `WidgetDisplay` ใน `types/dashboard-widget.ts`)
