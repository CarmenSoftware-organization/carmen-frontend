import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Strikethrough,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toggle } from "@/components/ui/toggle";
import { sanitizeEmailHtml } from "@/lib/email-template";
import { cn } from "@/lib/utils";

export interface RichTextEditorProps {
  readonly value: string;
  readonly onChange: (html: string) => void;
  /** ชื่อตัวแปรที่แทรกได้ (ไม่ใส่ = ไม่แสดงเมนูแทรกตัวแปร) */
  readonly placeholders?: readonly string[];
  readonly placeholderLabel?: string;
  readonly disabled?: boolean;
  readonly ariaInvalid?: boolean;
  readonly className?: string;
  readonly id?: string;
}

/**
 * ตัวแก้ไขข้อความแบบมีรูปแบบ (เนื้อเมล HTML)
 *
 * `"use no memo"` จำเป็นจริง — `useEditor` ของ TipTap คืน instance เดิมที่ mutate
 * ตัวเองแล้วแจ้งผ่าน external store ซึ่ง React Compiler มองว่าไม่เปลี่ยน แล้ว
 * memoize toolbar ค้างไว้ (ปุ่ม B/I ไม่ติดสถานะตามตำแหน่งเคอร์เซอร์) กับดักตระกูล
 * เดียวกับตารางใน `routes/CLAUDE.md`
 */
export function RichTextEditorInner({
  value,
  onChange,
  placeholders,
  placeholderLabel = "Insert variable",
  disabled,
  ariaInvalid,
  className,
  id,
}: RichTextEditorProps) {
  "use no memo";

  // HTML ก้อนล่าสุดที่ผ่านมือ editor ตัวนี้ (ทั้งที่พิมพ์เองและที่รับมาจากภายนอก)
  // ใช้แทนการถาม editor ว่าตอนนี้มีอะไรอยู่ — `editor.getHTML()` โยน
  // "Cannot read properties of null (reading 'cached')" เมื่อถูกเรียกหลัง editor
  // ถูก destroy ซึ่งเกิดทุกครั้งใน StrictMode (mount → unmount → remount)
  const lastHtmlRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "prose-email min-h-40 w-full px-3 py-2 text-xs outline-none [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline",
        ...(id ? { id } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      const html = sanitizeEmailHtml(editor.getHTML());
      lastHtmlRef.current = html;
      onChange(html);
    },
  });

  // ซิงก์ค่าจากภายนอก (สลับ template, รีเซ็ตฟอร์ม) โดยไม่กวนการพิมพ์ — ค่าที่เท่ากับ
  // ก้อนล่าสุดคือเสียงสะท้อนของสิ่งที่เพิ่งพิมพ์ ไม่ใช่การเปลี่ยนจากภายนอก ถ้า
  // setContent ทุกครั้งเคอร์เซอร์จะเด้งกลับต้นทุกตัวอักษร
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (value === lastHtmlRef.current) return;
    lastHtmlRef.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "border-input bg-field focus-within:border-ring focus-within:ring-ring/50 rounded-md border transition-[color,box-shadow] focus-within:ring-2",
        ariaInvalid && "border-destructive ring-destructive/20",
        disabled && "opacity-50",
        className,
      )}
    >
      <div className="border-border/60 flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
          aria-label="Bold"
        >
          <Bold aria-hidden="true" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
          aria-label="Italic"
        >
          <Italic aria-hidden="true" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("strike")}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
          disabled={disabled}
          aria-label="Strikethrough"
        >
          <Strikethrough aria-hidden="true" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() =>
            editor.chain().focus().toggleBulletList().run()
          }
          disabled={disabled}
          aria-label="Bullet list"
        >
          <List aria-hidden="true" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() =>
            editor.chain().focus().toggleOrderedList().run()
          }
          disabled={disabled}
          aria-label="Numbered list"
        >
          <ListOrdered aria-hidden="true" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("link")}
          onPressedChange={(pressed) => {
            if (!pressed) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            // เจตนาใช้ prompt ไม่ได้ เพราะ dialog ของเบราว์เซอร์บล็อกทั้งหน้า —
            // ลิงก์เอาจากข้อความที่เลือกไว้ (ผู้ใช้พิมพ์ URL แล้วลากคลุมแล้วกด)
            const selected = editor.state.doc
              .textBetween(
                editor.state.selection.from,
                editor.state.selection.to,
              )
              .trim();
            if (!/^(https?:\/\/|mailto:)/i.test(selected)) return;
            editor.chain().focus().setLink({ href: selected }).run();
          }}
          disabled={disabled}
          aria-label="Link"
        >
          <Link2 aria-hidden="true" />
        </Toggle>

        {placeholders && placeholders.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs"
                disabled={disabled}
              >
                {placeholderLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-auto">
              {placeholders.map((key) => (
                <DropdownMenuItem
                  key={key}
                  onSelect={() =>
                    editor.chain().focus().insertContent(`{{${key}}}`).run()
                  }
                  className="font-mono text-xs"
                >
                  {`{{${key}}}`}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
