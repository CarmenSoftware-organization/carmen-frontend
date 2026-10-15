import {
  BarChart,
  Box,
  Calendar,
  CheckBadge,
  Clipboard,
  DashboardGrid,
  Glyph,
  Lines,
  Paper,
  Pin,
  ProductCube,
  Shield,
  TileBase,
  WindowGrid,
  type TileRenderer,
} from "./primitives";

export const SubTiles: Record<string, TileRenderer> = {
  // ════ Dashboard ════
  dashboard: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <DashboardGrid palette={palette} rx={1.6} />
    </>
  ),
  purchaseRequest: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <Lines palette={palette} y={17} lengths={[11, 9]} />
      <path
        d="M 16 27 Q 19 23 22 27"
        style={{ stroke: palette.base }}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />
      <CheckBadge palette={palette} />
    </>
  ),
  purchaseOrder: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <rect
        x="14"
        y="17"
        width="13"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="14"
        y="20.4"
        width="11"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="14"
        y="23.8"
        width="9"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="14"
        y="27.2"
        width="6"
        height="2"
        rx="1"
        style={{ fill: palette.accent }}
      />
    </>
  ),
  goodsReceiveNote: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Box palette={palette} y={14} h={18} />
      <path
        d="M 20 9 L 20 16 M 17 13 L 20 16 L 23 13"
        style={{ stroke: palette.accent }}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <CheckBadge cx={29} cy={29} r={4.5} palette={palette} />
    </>
  ),
  inventoryManagement: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect
        x="14"
        y="9"
        width="12"
        height="9"
        rx="1.4"
        style={{ fill: palette.accent }}
      />
      <rect x="8" y="20" width="11" height="11" rx="1.4" fill="currentColor" />
      <rect x="21" y="20" width="11" height="11" rx="1.4" fill="currentColor" />
      <rect
        x="14"
        y="12.5"
        width="12"
        height="0.9"
        style={{ fill: palette.shadow }}
        opacity="0.3"
      />
    </>
  ),
  storeRequisition: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Clipboard palette={palette} />
      <path
        d="M 14 19 L 15.5 20.5 L 18 18"
        style={{ stroke: palette.base }}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <path
        d="M 14 25 L 15.5 26.5 L 18 24"
        style={{ stroke: palette.base }}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <rect
        x="20"
        y="19"
        width="7"
        height="1.3"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="20"
        y="25"
        width="7"
        height="1.3"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
    </>
  ),

  // ════ Procurement ════
  myApproval: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect x="8" y="21" width="24" height="10" rx="1.6" fill="currentColor" />
      <path d="M 8 21 L 12 16 H 28 L 32 21" style={{ fill: palette.accent }} />
      <rect x="14" y="9" width="12" height="13" rx="1.2" fill="currentColor" />
      <path
        d="M 16 13 L 18 15 L 23 11"
        style={{ stroke: palette.shadow }}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  purchaseRequestTemplate: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <rect
        x="14"
        y="17"
        width="6"
        height="2.4"
        rx="0.8"
        style={{ fill: palette.accent }}
      />
      <rect
        x="21"
        y="17"
        width="6"
        height="2.4"
        rx="0.8"
        style={{ fill: palette.accent }}
        opacity="0.5"
      />
      <rect
        x="14"
        y="21.4"
        width="6"
        height="2.4"
        rx="0.8"
        style={{ fill: palette.accent }}
        opacity="0.5"
      />
      <rect
        x="21"
        y="21.4"
        width="6"
        height="2.4"
        rx="0.8"
        style={{ fill: palette.accent }}
      />
      <rect
        x="14"
        y="25.8"
        width="6"
        height="2.4"
        rx="0.8"
        style={{ fill: palette.accent }}
        opacity="0.5"
      />
      <rect
        x="21"
        y="25.8"
        width="6"
        height="2.4"
        rx="0.8"
        style={{ fill: palette.accent }}
        opacity="0.5"
      />
    </>
  ),
  creditNote: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <Lines palette={palette} y={17} lengths={[11, 9]} />
      <circle cx="27" cy="27" r="5" style={{ fill: palette.accent }} />
      <rect
        x="24"
        y="26.2"
        width="6"
        height="1.6"
        rx="0.8"
        style={{ fill: palette.shadow }}
      />
    </>
  ),

  // ════ Products ════
  productCategory: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <path
        d="M 8 11 H 16 L 18 13 H 30 V 27 H 8 Z"
        style={{ fill: palette.accent }}
      />
      <path d="M 8 16 H 18 L 20 18 H 32 V 31 H 8 Z" fill="currentColor" />
      <rect
        x="11"
        y="22"
        width="14"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="11"
        y="25"
        width="10"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
    </>
  ),
  product: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <ProductCube palette={palette} />
    </>
  ),

  // ════ Vendors ════
  vendor: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect x="12" y="11" width="16" height="22" rx="1.5" fill="currentColor" />
      <WindowGrid fill={palette.base} x={14.5} y={14.5} cols={3} rows={2} />
      <rect
        x="18"
        y="25"
        width="4"
        height="8"
        style={{ fill: palette.accent }}
      />
    </>
  ),
  priceList: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <Glyph x={15.5} y={22} size={6.5} fill={palette.base} opacity={0.85}>
        $
      </Glyph>
      <rect
        x="20"
        y="17.5"
        width="7"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <Glyph x={15.5} y={29} size={6.5} fill={palette.base} opacity={0.85}>
        $
      </Glyph>
      <rect
        x="20"
        y="24.5"
        width="5"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
    </>
  ),
  priceListTemplate: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <rect
        x="14"
        y="17"
        width="13"
        height="3"
        rx="0.8"
        style={{ fill: palette.accent }}
        opacity="0.5"
      />
      <Glyph x={15} y={26} size={7} fill={palette.base} opacity={0.85}>
        $
      </Glyph>
      <rect
        x="20"
        y="22"
        width="7"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="20"
        y="26"
        width="7"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
    </>
  ),
  requestPriceList: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <Glyph x={15} y={22} size={7} fill={palette.base} opacity={0.85}>
        $
      </Glyph>
      <rect
        x="20"
        y="18"
        width="7"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <path
        d="M 27 27 L 32 27 M 30 25 L 32 27 L 30 29"
        style={{ stroke: palette.accent }}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),

  // ════ Store Ops ════
  stockReplenishment: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Box palette={palette} y={16} h={16} />
      <path
        d="M 20 14 L 20 7 M 16 11 L 20 7 L 24 11"
        style={{ stroke: palette.accent }}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  wastageReporting: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <path d="M 20 9 L 32 30 H 8 Z" fill="currentColor" />
      <rect
        x="19"
        y="16"
        width="2"
        height="7"
        rx="1"
        style={{ fill: palette.base }}
      />
      <circle cx="20" cy="26" r="1.3" style={{ fill: palette.base }} />
    </>
  ),

  // ════ Inventory ════
  inventoryAdjustment: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Box palette={palette} x={9} y={12} w={11} h={9} />
      <Box palette={palette} x={9} y={23} w={11} h={9} />
      <path
        d="M 27 12 L 27 30 M 24 15 L 27 12 L 30 15 M 24 27 L 27 30 L 30 27"
        style={{ stroke: palette.accent }}
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  transaction: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <rect
        x="14"
        y="17"
        width="13"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="14"
        y="20.4"
        width="13"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="14"
        y="23.8"
        width="13"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="14"
        y="27.2"
        width="13"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <path
        d="M 28 9 L 32 13 L 28 17"
        style={{ stroke: palette.accent }}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  physicalCount: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Clipboard palette={palette} />
      <path
        d="M 14 19 L 15.5 20.5 L 18 18"
        style={{ stroke: palette.base }}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <path
        d="M 14 24 L 15.5 25.5 L 18 23"
        style={{ stroke: palette.base }}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <path
        d="M 14 29 L 15.5 30.5 L 18 28"
        style={{ stroke: palette.base }}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <rect
        x="20"
        y="19"
        width="7"
        height="1.2"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="20"
        y="24"
        width="7"
        height="1.2"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="20"
        y="29"
        width="7"
        height="1.2"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
    </>
  ),
  spotCheck: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Box palette={palette} x={9} y={11} w={22} h={18} />
      <circle
        cx="22"
        cy="22"
        r="5"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="2"
      />
      <path
        d="M 26 26 L 30 30"
        style={{ stroke: palette.accent }}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="22"
        cy="22"
        r="2"
        style={{ fill: palette.shadow }}
        opacity="0.5"
      />
    </>
  ),
  periodEnd: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Calendar palette={palette} />
      <path
        d="M 16 21 L 19 24 L 25 18"
        style={{ stroke: palette.base }}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <circle cx="28" cy="29" r="3.6" style={{ fill: palette.accent }} />
      <rect
        x="26.5"
        y="28"
        width="3"
        height="2.5"
        rx="0.5"
        style={{ fill: palette.shadow }}
      />
    </>
  ),

  // ════ Operations ════
  operationRecipe: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <path d="M 10 9 H 20 V 32 H 11 Q 10 32 10 31 Z" fill="currentColor" />
      <path
        d="M 20 9 H 30 Q 30 9 30 10 V 31 Q 30 32 29 32 H 20 Z"
        style={{ fill: palette.accent }}
      />
      <rect
        x="13"
        y="14"
        width="5"
        height="1.2"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="13"
        y="17"
        width="5"
        height="1.2"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="13"
        y="20"
        width="5"
        height="1.2"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="22"
        y="14"
        width="5"
        height="1.2"
        rx="0.6"
        style={{ fill: palette.shadow }}
        opacity="0.35"
      />
      <rect
        x="22"
        y="17"
        width="5"
        height="1.2"
        rx="0.6"
        style={{ fill: palette.shadow }}
        opacity="0.35"
      />
      <rect
        x="22"
        y="20"
        width="5"
        height="1.2"
        rx="0.6"
        style={{ fill: palette.shadow }}
        opacity="0.35"
      />
    </>
  ),
  operationCategory: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <path d="M 8 16 H 18 L 20 18 H 32 V 31 H 8 Z" fill="currentColor" />
      <rect
        x="14"
        y="20"
        width="1.5"
        height="8"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.7"
      />
      <rect
        x="22"
        y="20"
        width="1.6"
        height="8"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.7"
      />
      <path
        d="M 21 20 Q 24 20 24 23 H 22 Z"
        style={{ fill: palette.base }}
        opacity="0.7"
      />
    </>
  ),
  operationCuisine: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <circle cx="20" cy="22" r="11" fill="currentColor" />
      <circle
        cx="20"
        cy="22"
        r="7"
        fill="none"
        style={{ stroke: palette.base }}
        strokeWidth="0.8"
        opacity="0.3"
      />
      <rect
        x="12"
        y="11"
        width="1.6"
        height="9"
        rx="0.6"
        style={{ fill: palette.shadow }}
        transform="rotate(-25 12.8 15.5)"
      />
      <rect
        x="26"
        y="11"
        width="1.6"
        height="9"
        rx="0.6"
        style={{ fill: palette.shadow }}
        transform="rotate(25 26.8 15.5)"
      />
    </>
  ),
  operationEquipment: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <path
        d="M 25 8 A 6 6 0 1 0 30 16 L 32 18 L 30 20 L 28 18 L 26 20 L 24 18 L 26 16 A 6 6 0 0 0 25 8 Z"
        fill="currentColor"
      />
      <path
        d="M 11 24 L 23 12 L 27 16 L 15 28 Q 13 30 11 28 Z"
        style={{ fill: palette.accent }}
      />
    </>
  ),
  operationEquipmentCategory: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <path d="M 8 16 H 18 L 20 18 H 32 V 31 H 8 Z" fill="currentColor" />
      <path
        d="M 23 21 A 3 3 0 1 0 25 25 L 27 27 L 25 29 L 23 27 L 21 29 L 19 27 L 21 25 A 3 3 0 0 0 23 21 Z"
        style={{ fill: palette.base }}
        opacity="0.7"
      />
      <rect
        x="11"
        y="22"
        width="6"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="11"
        y="25"
        width="5"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
    </>
  ),

  // ════ Reports ════
  reportList: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <BarChart palette={palette} />
    </>
  ),
  reportSchedule: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Calendar palette={palette} />
      <circle
        cx="15"
        cy="22"
        r="1.4"
        style={{ fill: palette.base }}
        opacity="0.5"
      />
      <circle cx="20" cy="22" r="1.4" style={{ fill: palette.accent }} />
      <circle
        cx="25"
        cy="22"
        r="1.4"
        style={{ fill: palette.base }}
        opacity="0.5"
      />
      <circle
        cx="15"
        cy="27"
        r="1.4"
        style={{ fill: palette.base }}
        opacity="0.5"
      />
      <circle
        cx="20"
        cy="27"
        r="1.4"
        style={{ fill: palette.base }}
        opacity="0.5"
      />
      <circle cx="25" cy="27" r="1.4" style={{ fill: palette.accent }} />
    </>
  ),
  reportHistory: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <circle cx="20" cy="22" r="11" fill="currentColor" />
      <circle
        cx="20"
        cy="22"
        r="11"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1"
        opacity="0.5"
      />
      <path
        d="M 20 14 V 22 L 25.5 25"
        style={{ stroke: palette.base }}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),

  // ════ Configuration ════
  storeLocation: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Pin>
        <circle cx="20" cy="17" r="3.5" style={{ fill: palette.accent }} />
      </Pin>
    </>
  ),
  department: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect x="9" y="14" width="10" height="17" rx="1.4" fill="currentColor" />
      <rect
        x="21"
        y="10"
        width="11"
        height="21"
        rx="1.4"
        style={{ fill: palette.accent }}
      />
      <WindowGrid
        fill={palette.base}
        x={11.5}
        y={17}
        cols={2}
        rows={2}
        colGap={3.5}
        rowGap={4}
        size={2}
        opacity={0.5}
      />
      <WindowGrid
        fill={palette.shadow}
        x={23.5}
        y={14}
        cols={2}
        rows={2}
        colGap={3.5}
        rowGap={4}
        size={2}
        opacity={0.5}
      />
    </>
  ),
  deliveryPoint: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Pin>
        <rect
          x="14"
          y="15"
          width="7"
          height="5"
          rx="0.6"
          style={{ fill: palette.accent }}
        />
        <path
          d="M 21 16 H 25 L 27 18 V 20 H 21 Z"
          style={{ fill: palette.accent }}
        />
        <circle cx="17" cy="21" r="1.2" style={{ fill: palette.shadow }} />
        <circle cx="24" cy="21" r="1.2" style={{ fill: palette.shadow }} />
      </Pin>
    </>
  ),
  unit: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect x="8" y="17" width="24" height="9" rx="1.6" fill="currentColor" />
      <path
        d="M 12 17 V 21 M 16 17 V 23 M 20 17 V 21 M 24 17 V 23 M 28 17 V 21"
        style={{ stroke: palette.base }}
        strokeWidth="1"
        opacity="0.55"
      />
      <rect
        x="8"
        y="17"
        width="24"
        height="2"
        style={{ fill: palette.accent }}
      />
    </>
  ),
  adjustmentType: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect
        x="9"
        y="13"
        width="22"
        height="2"
        rx="1"
        fill="currentColor"
        opacity="0.7"
      />
      <circle cx="16" cy="14" r="2.5" fill="currentColor" />
      <circle cx="16" cy="14" r="1.2" style={{ fill: palette.accent }} />
      <rect
        x="9"
        y="19"
        width="22"
        height="2"
        rx="1"
        fill="currentColor"
        opacity="0.7"
      />
      <circle cx="24" cy="20" r="2.5" fill="currentColor" />
      <circle cx="24" cy="20" r="1.2" style={{ fill: palette.accent }} />
      <rect
        x="9"
        y="25"
        width="22"
        height="2"
        rx="1"
        fill="currentColor"
        opacity="0.7"
      />
      <circle cx="19" cy="26" r="2.5" fill="currentColor" />
      <circle cx="19" cy="26" r="1.2" style={{ fill: palette.accent }} />
    </>
  ),
  businessType: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect x="8" y="15" width="24" height="17" rx="1.6" fill="currentColor" />
      <path
        d="M 15 15 V 12 Q 15 11 16 11 H 24 Q 25 11 25 12 V 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <rect
        x="8"
        y="20"
        width="24"
        height="2"
        style={{ fill: palette.accent }}
      />
      <rect
        x="18"
        y="19"
        width="4"
        height="4"
        rx="0.5"
        style={{ fill: palette.shadow }}
      />
    </>
  ),
  creditNoteReason: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <path
        d="M 9 12 H 31 Q 32 12 32 13 V 25 Q 32 26 31 26 H 22 L 17 31 V 26 H 9 Q 8 26 8 25 V 13 Q 8 12 9 12 Z"
        fill="currentColor"
      />
      <rect
        x="13"
        y="17"
        width="14"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="13"
        y="20.4"
        width="10"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
    </>
  ),
  currency: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <circle cx="20" cy="20" r="11" fill="currentColor" />
      <circle
        cx="20"
        cy="20"
        r="8.5"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1"
        opacity="0.6"
      />
      <Glyph x={20} y={25} size={13} fill={palette.base} anchor="middle">
        $
      </Glyph>
    </>
  ),
  exchangeRate: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <circle cx="14" cy="16" r="6" fill="currentColor" />
      <Glyph x={14} y={19} size={8} fill={palette.base} anchor="middle">
        $
      </Glyph>
      <circle cx="26" cy="26" r="6" style={{ fill: palette.accent }} />
      <Glyph x={26} y={29} size={8} fill={palette.shadow} anchor="middle">
        €
      </Glyph>
    </>
  ),
  taxProfile: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <Glyph
        x={20}
        y={26}
        size={11}
        fill={palette.base}
        anchor="middle"
        opacity={0.85}
      >
        %
      </Glyph>
    </>
  ),
  creditTerm: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <circle cx="20" cy="20" r="11" fill="currentColor" />
      <Glyph
        x={20}
        y={24}
        size={11}
        fill={palette.base}
        anchor="middle"
        opacity={0.85}
      >
        $
      </Glyph>
      <path
        d="M 20 12 V 20 L 26 23"
        style={{ stroke: palette.accent }}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  extraCost: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <circle cx="15" cy="18" r="5" style={{ fill: palette.accent }} />
      <Glyph x={15} y={21} size={6.5} fill={palette.shadow} anchor="middle">
        $
      </Glyph>
      <circle cx="25" cy="24" r="5" fill="currentColor" />
      <Glyph x={25} y={27} size={6.5} fill={palette.base} anchor="middle">
        $
      </Glyph>
      <path
        d="M 30 14 V 18 M 28 16 H 32"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  ),
  certification: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      {/* Ribbon left tail */}
      <path
        d="M 14 23 L 10 36 L 17 33 Z"
        style={{ fill: palette.accent }}
        opacity="0.9"
      />
      {/* Ribbon right tail */}
      <path
        d="M 26 23 L 30 36 L 23 33 Z"
        style={{ fill: palette.accent }}
        opacity="0.9"
      />
      {/* Ribbon center fold */}
      <path
        d="M 17 33 L 20 30 L 23 33 L 20 36 Z"
        style={{ fill: palette.shadow }}
        opacity="0.55"
      />
      {/* Medal body (white) */}
      <circle cx="20" cy="17" r="9" fill="currentColor" />
      {/* Scalloped ring */}
      <circle
        cx="20"
        cy="17"
        r="8"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1"
        strokeDasharray="1.5 1.2"
        opacity="0.55"
      />
      {/* Inner accent disc */}
      <circle cx="20" cy="17" r="5" style={{ fill: palette.accent }} />
      {/* 5-point star */}
      <path
        d="M 20 13.5 L 21 16 L 23.7 16.2 L 21.6 17.9 L 22.3 20.5 L 20 19 L 17.7 20.5 L 18.4 17.9 L 16.3 16.2 L 19 16 Z"
        fill="currentColor"
      />
    </>
  ),
  eco: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      {/* Leaf body */}
      <path
        d="M 10 30 Q 10 14 26 10 Q 32 14 32 22 Q 32 30 22 32 Q 14 32 10 30 Z"
        style={{ fill: palette.accent }}
      />
      {/* Main vein */}
      <path
        d="M 12 30 Q 18 22 28 13"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Side veins */}
      <path
        d="M 17 24 L 20 21 M 20 27 L 23 24"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
        opacity="0.5"
      />
    </>
  ),

  // ════ System Admin ════
  period: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Calendar palette={palette} />
      <rect
        x="14"
        y="20"
        width="3"
        height="3"
        rx="0.5"
        style={{ fill: palette.base }}
        opacity="0.55"
      />
      <rect
        x="18.5"
        y="20"
        width="3"
        height="3"
        rx="0.5"
        style={{ fill: palette.accent }}
      />
      <rect
        x="23"
        y="20"
        width="3"
        height="3"
        rx="0.5"
        style={{ fill: palette.base }}
        opacity="0.55"
      />
      <rect
        x="14"
        y="25"
        width="3"
        height="3"
        rx="0.5"
        style={{ fill: palette.base }}
        opacity="0.55"
      />
      <rect
        x="18.5"
        y="25"
        width="3"
        height="3"
        rx="0.5"
        style={{ fill: palette.base }}
        opacity="0.55"
      />
    </>
  ),
  workflow: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <circle cx="11" cy="13" r="3.6" style={{ fill: palette.accent }} />
      <circle cx="29" cy="13" r="3.6" fill="currentColor" />
      <circle cx="20" cy="28" r="3.6" fill="currentColor" />
      <path
        d="M 14 14 Q 18 20 17.5 25"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 26 14 Q 22 20 22.5 25"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  role: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Shield palette={palette} />
    </>
  ),
  user: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <circle cx="20" cy="16" r="5.5" fill="currentColor" />
      <path d="M 9 33 Q 9 23 20 23 Q 31 23 31 33 Z" fill="currentColor" />
      <circle cx="27" cy="27" r="4" style={{ fill: palette.accent }} />
      <path
        d="M 25.2 27 L 26.5 28.3 L 28.8 25.8"
        style={{ stroke: palette.shadow }}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  runningCode: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <Glyph
        x={20}
        y={27}
        size={11}
        fill={palette.base}
        anchor="middle"
        opacity={0.85}
      >
        #
      </Glyph>
      <rect
        x="14"
        y="11"
        width="6"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
    </>
  ),
  document: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect
        x="13"
        y="8"
        width="18"
        height="22"
        rx="1.4"
        style={{ fill: palette.accent }}
      />
      <Paper palette={palette} x={9} y={12} w={18} h={20} fold={5} />
      <rect
        x="12"
        y="20"
        width="11"
        height="1.3"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="12"
        y="23"
        width="9"
        height="1.3"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
      <rect
        x="12"
        y="26"
        width="7"
        height="1.3"
        rx="0.6"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
    </>
  ),
  userActivity: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <circle cx="14" cy="14" r="4.5" fill="currentColor" />
      <path d="M 7 26 Q 7 19 14 19 Q 18 19 20 22" fill="currentColor" />
      <rect
        x="20"
        y="20"
        width="13"
        height="11"
        rx="1.4"
        style={{ fill: palette.accent }}
      />
      <path
        d="M 22 25 L 25 22 L 28 27 L 31 23"
        style={{ stroke: palette.shadow }}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),
  activityLog: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect x="8" y="14" width="24" height="14" rx="1.6" fill="currentColor" />
      <path
        d="M 9 22 L 13 22 L 15 17 L 18 26 L 21 19 L 23 22 L 31 22"
        style={{ stroke: palette.accent }}
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  configEmail: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect x="8" y="13" width="24" height="16" rx="1.6" fill="currentColor" />
      <path
        d="M 8 14 L 20 23 L 32 14"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </>
  ),
  notificationTemplate: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      {/* Handle knob */}
      <circle cx="20" cy="8" r="1.8" style={{ fill: palette.accent }} />
      {/* Bell body */}
      <path
        d="M 20 9.5 C 14.5 9.5 13 12.8 13 17.2 C 13 21.8 10.5 25.5 10.5 25.5 H 29.5 C 29.5 25.5 27 21.8 27 17.2 C 27 12.8 25.5 9.5 20 9.5 Z"
        fill="currentColor"
      />
      {/* Rim shadow */}
      <rect
        x="10.5"
        y="23.8"
        width="19"
        height="1.7"
        rx="0.85"
        style={{ fill: palette.shadow }}
        opacity="0.18"
      />
      {/* Clapper */}
      <circle cx="20" cy="28.6" r="2.1" style={{ fill: palette.accent }} />
    </>
  ),
  dashboardDataset: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      {/* Mini dashboard grid — top half */}
      <rect x="9" y="9" width="9" height="5" rx="1.2" fill="currentColor" />
      <rect
        x="20"
        y="9"
        width="11"
        height="5"
        rx="1.2"
        style={{ fill: palette.accent }}
      />
      <rect
        x="9"
        y="15"
        width="9"
        height="5"
        rx="1.2"
        style={{ fill: palette.accent }}
      />
      <rect x="20" y="15" width="11" height="5" rx="1.2" fill="currentColor" />
      {/* Database cylinder — bottom half */}
      <ellipse
        cx="20"
        cy="23"
        rx="10"
        ry="2.2"
        style={{ fill: palette.accent }}
      />
      <rect x="10" y="23" width="20" height="7" fill="currentColor" />
      <ellipse cx="20" cy="30" rx="10" ry="2.2" fill="currentColor" />
      <ellipse
        cx="20"
        cy="26.5"
        rx="10"
        ry="2.2"
        fill="none"
        style={{ stroke: palette.base }}
        strokeWidth="0.7"
        opacity="0.4"
      />
      <path
        d="M 10 23 V 30 M 30 23 V 30"
        style={{ stroke: palette.base }}
        strokeWidth="0.6"
        opacity="0.3"
        fill="none"
      />
    </>
  ),
  // ════ Accounting ════
  // NOTE: ทุกรายละเอียดที่ต้อง "มองเห็น" ใช้ currentColor (= --tile-ink) หรือ
  // palette.accent เท่านั้น — palette.base คือ --tile-surface ซึ่งเป็น
  // `transparent` ทั้งแอป (styles/module-colors.css) วาดด้วยมันแล้วหายไปเงียบ ๆ
  generalLedger: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} x={9} y={7} w={22} h={26} />
      <path
        d="M 14 14 H 26 M 14 18 H 26 M 14 22 H 20"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Glyph x={20} y={29.5} size={7.5} fill={palette.accent} anchor="middle">
        GL
      </Glyph>
    </>
  ),
  journalVoucher: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <rect
        x="14"
        y="16"
        width="11"
        height="1.6"
        rx="0.8"
        style={{ fill: palette.accent }}
      />
      <rect
        x="14"
        y="19.6"
        width="8"
        height="1.6"
        rx="0.8"
        style={{ fill: palette.accent }}
        opacity="0.6"
      />
      <Glyph x={20} y={29.5} size={8.5} fill={palette.accent} anchor="middle">
        JV
      </Glyph>
    </>
  ),
  templateVoucher: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} x={9} y={7} w={18} h={22} />
      <rect
        x="13"
        y="12"
        width="18"
        height="22"
        rx="1.6"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1.4"
        strokeDasharray="3 2.4"
      />
    </>
  ),
  recurringVoucher: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <path
        d="M 15 24 A 5 5 0 1 1 20 29"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M 15 20.5 V 24.5 H 19"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  allocationVoucher: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect x="7" y="17" width="8" height="6" rx="1.2" fill="currentColor" />
      <path
        d="M 15 20 H 20 M 20 12 V 28 M 20 12 H 24 M 20 20 H 24 M 20 28 H 24"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect x="24" y="9" width="8" height="6" rx="1.2" fill="currentColor" />
      <rect
        x="24"
        y="17"
        width="8"
        height="6"
        rx="1.2"
        style={{ fill: palette.accent }}
      />
      <rect x="24" y="25" width="8" height="6" rx="1.2" fill="currentColor" />
    </>
  ),
  accountsPayable: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <path
        d="M 20 14 V 24 M 16.5 20.5 L 20 24 L 23.5 20.5"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Glyph x={20} y={30.5} size={7.5} fill={palette.accent} anchor="middle">
        AP
      </Glyph>
    </>
  ),
  accountsReceivable: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <path
        d="M 20 24 V 14 M 16.5 17.5 L 20 14 L 23.5 17.5"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Glyph x={20} y={30.5} size={7.5} fill={palette.accent} anchor="middle">
        AR
      </Glyph>
    </>
  ),
  asset: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <path d="M 9 17 L 20 10 L 31 17 Z" fill="currentColor" opacity="0.9" />
      <path
        d="M 12 18 V 29 M 17.3 18 V 29 M 22.7 18 V 29 M 28 18 V 29 M 9 31 H 31"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  financialReports: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} x={9} y={8} w={22} h={24} fold={0} />
      <rect
        x="13"
        y="22"
        width="3.6"
        height="6"
        rx="0.9"
        style={{ fill: palette.accent }}
        opacity="0.55"
      />
      <rect
        x="18.2"
        y="18"
        width="3.6"
        height="10"
        rx="0.9"
        style={{ fill: palette.accent }}
      />
      <rect
        x="23.4"
        y="13.5"
        width="3.6"
        height="14.5"
        rx="0.9"
        style={{ fill: palette.accent }}
        opacity="0.75"
      />
    </>
  ),
  // ════ Config ════
  chartOfAccounts: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <Paper palette={palette} />
      <Glyph x={20} y={26} size={14} fill={palette.accent} anchor="middle">
        #
      </Glyph>
    </>
  ),
  chartOfAccountMapping: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect x="7" y="12" width="8" height="7" rx="1.2" fill="currentColor" />
      <rect x="7" y="22" width="8" height="7" rx="1.2" fill="currentColor" />
      <path
        d="M 15 15.5 H 25 M 15 25.5 H 25"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect
        x="25"
        y="12"
        width="8"
        height="7"
        rx="1.2"
        style={{ fill: palette.accent }}
      />
      <rect
        x="25"
        y="22"
        width="8"
        height="7"
        rx="1.2"
        style={{ fill: palette.accent }}
      />
    </>
  ),
  shelf: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect x="11" y="11" width="5" height="7" rx="0.9" fill="currentColor" />
      <rect
        x="18"
        y="13"
        width="6"
        height="5"
        rx="0.9"
        style={{ fill: palette.accent }}
      />
      <rect x="11" y="21" width="7" height="6" rx="0.9" fill="currentColor" />
      <rect
        x="20"
        y="20"
        width="5"
        height="7"
        rx="0.9"
        style={{ fill: palette.accent }}
      />
      <path
        d="M 8 18.6 H 32 M 8 27.6 H 32"
        fill="none"
        style={{ stroke: palette.accent }}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </>
  ),
  // คำนำหน้าชื่อ (Mr./Mrs./Dr.) — ป้ายชื่อ: คนด้านซ้าย + แถบคำนำหน้าสี accent
  titleMaster: ({ palette }) => (
    <>
      <TileBase palette={palette} />
      <rect x="7" y="11" width="26" height="19" rx="2" fill="currentColor" />
      <circle cx="14" cy="18" r="3" style={{ fill: palette.base }} />
      <path
        d="M 9.5 26.5 Q 9.5 22 14 22 Q 18.5 22 18.5 26.5 Z"
        style={{ fill: palette.base }}
      />
      <rect
        x="21"
        y="15.5"
        width="8"
        height="3"
        rx="1.5"
        style={{ fill: palette.accent }}
      />
      <rect
        x="21"
        y="21"
        width="9"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.5"
      />
      <rect
        x="21"
        y="24.5"
        width="6"
        height="1.4"
        rx="0.7"
        style={{ fill: palette.base }}
        opacity="0.35"
      />
    </>
  ),
};
