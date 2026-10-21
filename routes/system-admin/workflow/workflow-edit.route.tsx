import { useParams } from "react-router";
import { WfEditContent } from "./wf-edit-content";

export function Component() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  // key = id: ทำสำเนาแล้วพามา path ใหม่ใน route เดิม — ไม่ remount state ฟอร์ม/stage ที่เลือกจะค้างของต้นฉบับ
  return <WfEditContent key={id} id={id} />;
}
