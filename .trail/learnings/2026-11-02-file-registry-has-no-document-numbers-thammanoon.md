---
title: File registry has no document numbers and deleting a file leaves broken attachment copies
author: Thammanoon
date: 2026-11-02
branch: docs/document-trace-cleanup-spec
cost: { minutes: 11, tokens: 145192 }
id: l-d492cd0c
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-03-document-trace-and-cleanup-design.md
  - ".superpowers/brainstorm/22934-1793640269/content/document-layout.html"
  - ".superpowers/brainstorm/22934-1793640269/content/waiting.html"
  - types/document.ts
---

## Decided
- Spec docs/superpowers/specs/2026-11-03-document-trace-and-cleanup-design.md: on delete, rewrite the attachment element in place as a tombstone ({deleted:true, deleted_at, deleted_by_id}, no fileName/fileToken) BEFORE removing the MinIO object (micro-file DB and tenant DB are separate, so no transaction; this ordering never leaves a visible broken link).
- User chose in-table filter + select-all-matching (mockup option A) over a separate cleanup wizard. No protected files: "ลบได้ทุกไฟล์ถ้าเลือกเอง".

## Watch out
- micro-file tb_file_tag.reference_no is never populated by comment flows: tagAttachmentsByReference (backend-gateway/src/common/helpers/tag-attachments-by-reference.ts) sends only reference_type + reference_id (the parent entity id, not the comment id). Showing or searching by doc number needs resolve-by-id or a backfill.
- micro-file deleteFile (src/files/files.service.ts ~450) removes the MinIO object and soft-deletes tb_file_tag only. ~60 tenant tables (tb_*_comment, tb_*_detail_comment, tb_certificate, tb_eco_label, tb_recipe_equipment, tb_ap/ar_*) keep their own attachments JSON copy, so deletes from /system-admin/document leave "File Not Found" placeholders.
- The list API already returns reference_type/id/no, description and created_at, but FE types/document.ts does not declare them.
