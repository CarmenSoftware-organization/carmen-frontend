// ไฟล์อยู่ที่ public/carmen-logo.svg (ใช้ร่วมกับ favicon) — อ้างด้วย path ตรง
const carmenLogoUrl = "/carmen-logo.svg";

type CarmenLogoProps = {
  readonly variant?: "mark" | "lockup";
  readonly size?: number;
  readonly title?: string;
};

export function CarmenLogo({
  variant = "mark",
  size = 32,
  title = "Carmen Blue",
}: CarmenLogoProps) {
  const mark = (
    <img src={carmenLogoUrl} width={size} height={size} alt={title} />
  );

  if (variant === "lockup") {
    return <span>{mark} CARMEN BLUE</span>;
  }

  return mark;
}
