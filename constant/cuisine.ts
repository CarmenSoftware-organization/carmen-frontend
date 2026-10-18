export const CUISINE_REGION = {
  ASIA: "ASIA",
  EUROPE: "EUROPE",
  AMERICAS: "AMERICAS",
  AFRICA: "AFRICA",
  MIDDLE_EAST: "MIDDLE_EAST",
  OCEANIA: "OCEANIA",
} as const;

export type CuisineRegion =
  (typeof CUISINE_REGION)[keyof typeof CUISINE_REGION];

export const CUISINE_REGION_LABEL_KEY: Record<string, string> = {
  [CUISINE_REGION.ASIA]: "regionAsia",
  [CUISINE_REGION.EUROPE]: "regionEurope",
  [CUISINE_REGION.AMERICAS]: "regionAmericas",
  [CUISINE_REGION.AFRICA]: "regionAfrica",
  [CUISINE_REGION.MIDDLE_EAST]: "regionMiddleEast",
  [CUISINE_REGION.OCEANIA]: "regionOceania",
};

/**
 * สีจุดนำหน้าชื่อ region — ใช้ palette `--chart-*` ของแอป (มีค่าคู่ dark mode แล้ว)
 * ตัวอักษรยังเป็นสีกลาง สีอยู่ที่จุดอย่างเดียว · เว้น `--chart-4` เพราะชมพูอ่อน
 * บนพื้นขาวไม่ถึง 3:1 ของ non-text contrast
 */
export const CUISINE_REGION_DOT: Record<string, string> = {
  [CUISINE_REGION.ASIA]: "bg-[var(--chart-5)]",
  [CUISINE_REGION.EUROPE]: "bg-[var(--chart-1)]",
  [CUISINE_REGION.AMERICAS]: "bg-[var(--chart-3)]",
  [CUISINE_REGION.AFRICA]: "bg-[var(--chart-8)]",
  [CUISINE_REGION.MIDDLE_EAST]: "bg-[var(--chart-2)]",
  [CUISINE_REGION.OCEANIA]: "bg-[var(--chart-7)]",
};

export const CUISINE_REGION_OPTIONS: { value: CuisineRegion; label: string }[] =
  [
    { value: CUISINE_REGION.ASIA, label: "Asia" },
    { value: CUISINE_REGION.EUROPE, label: "Europe" },
    { value: CUISINE_REGION.AMERICAS, label: "Americas" },
    { value: CUISINE_REGION.AFRICA, label: "Africa" },
    { value: CUISINE_REGION.MIDDLE_EAST, label: "Middle East" },
    { value: CUISINE_REGION.OCEANIA, label: "Oceania" },
  ];
