# ตั้งค่า Email profile ให้ส่งเมลผ่าน Microsoft (OAuth2)

คู่มือสำหรับผู้ดูแลระบบของลูกค้า ใช้กับหน้า **System Admin → Email profile** เมื่อต้องส่งเมล (PO / RFP)
ผ่านบัญชี Microsoft ที่ปิด basic auth ของ SMTP แล้ว เลือก **วิธียืนยันตัวตน** ในฟอร์มโปรไฟล์ตามชนิดบัญชี:

| ชนิดบัญชี | วิธียืนยันตัวตนในฟอร์ม | Host / Port (เติมให้อัตโนมัติ) |
|---|---|---|
| Hotmail / Outlook.com ส่วนตัว | Microsoft — Hotmail / Outlook.com | `smtp-mail.outlook.com` : 587 |
| Microsoft 365 ขององค์กร | Microsoft 365 (องค์กร) | `smtp.office365.com` : 587 |

ทั้งสองแบบไม่ติ๊ก SSL (ใช้ STARTTLS) ส่วนแบบ "ชื่อผู้ใช้และรหัสผ่าน" ใช้ได้เหมือนเดิม

## 1. Hotmail / Outlook.com

ต้องสร้าง App ใน Microsoft Entra ก่อน (ไม่ต้องใช้ client secret ไม่ต้องใส่ Redirect URI)

1. เข้า <https://portal.azure.com> → **Microsoft Entra ID** → **App registrations** → **New registration**
2. **Supported account types** เลือก *Personal Microsoft accounts only* · **Redirect URI** ปล่อยว่าง → Register
3. เมนู **Authentication** → **Advanced settings** → **Allow public client flows** = **Yes** → Save
4. เมนู **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** เลือก
   `SMTP.Send`, `offline_access`, `openid`, `email`
5. คัดลอก **Application (client) ID** จากหน้า Overview
6. ใน Carmen Blue: สร้างโปรไฟล์ เลือกวิธียืนยันตัวตน "Microsoft — Hotmail / Outlook.com" กรอก
   **Application (client) ID** และ **Mailbox (อีเมล)** (อีเมลที่จะใช้ส่ง) → บันทึก
7. กด **เชื่อมต่อ** ที่แถวของโปรไฟล์ในรายการ จะมีหน้าต่างแสดงรหัส กด **เปิดหน้าล็อกอิน Microsoft**
   ใส่รหัส แล้วล็อกอินด้วยบัญชีเดียวกับ Mailbox และกดยอมรับสิทธิ์ เมื่อสำเร็จสถานะจะขึ้นว่าเชื่อมต่อแล้ว
8. กดปุ่มทดสอบส่งเพื่อยืนยัน

ต้องล็อกอินด้วยบัญชีที่ตรงกับ Mailbox ของโปรไฟล์เท่านั้น ถ้าเป็นบัญชีอื่นระบบจะปฏิเสธ

## 2. Microsoft 365 (องค์กร)

1. **App registrations** → **New registration** เลือก *Accounts in this organizational directory only*
2. คัดลอก **Directory (tenant) ID** และ **Application (client) ID** จากหน้า Overview
3. **Certificates & secrets** → **New client secret** คัดลอกค่าในคอลัมน์ **Value** ทันที
   (ดูซ้ำไม่ได้ — **ไม่ใช่** คอลัมน์ Secret ID ซึ่งเป็นแค่รหัสอ้างอิง ใช้แทน secret ไม่ได้)
   และบันทึกวันหมดอายุไว้ ต้องมาเปลี่ยนใน Carmen Blue ก่อนหมดอายุ ไม่งั้นส่งเมลไม่ได้
4. **API permissions** → **Add a permission** → **APIs my organization uses** → **Office 365 Exchange Online**
   → **Application permissions** → `SMTP.SendAsApp` → กด **Grant admin consent**
5. เปิด Exchange Online PowerShell แล้วรัน:

   ```powershell
   Connect-ExchangeOnline
   New-ServicePrincipal -AppId <Application (client) ID> -ObjectId <Object ID ของ Enterprise application>
   Add-MailboxPermission -Identity <mailbox@company.com> -User <Object ID เดียวกัน> -AccessRights FullAccess
   Set-CASMailbox -Identity <mailbox@company.com> -SmtpClientAuthenticationDisabled $false
   ```

   ⚠️ ObjectId ต้องมาจาก **Enterprise applications** ไม่ใช่ App registrations (เป็นคนละค่ากัน
   และเป็นจุดที่ตั้งผิดบ่อยที่สุด) — Enterprise application ของแอปจะโผล่หลังกด Grant admin
   consent ในข้อ 4 แล้ว อ่าน **Object ID** ได้ที่ **Enterprise applications** → (ชื่อแอป) → **Overview**

   สิทธิ์ที่เพิ่งให้ (admin consent / `Add-MailboxPermission`) อาจใช้เวลาหลายนาทีกว่าจะมีผล
   ถ้าทดสอบส่งทันทีแล้วไม่ผ่าน ให้รอสักครู่แล้วลองใหม่
6. ใน Carmen Blue: เลือกวิธียืนยันตัวตน "Microsoft 365 (องค์กร)" กรอก **Directory (tenant) ID**,
   **Application (client) ID**, **Client secret** และ Mailbox → บันทึก → กดปุ่มทดสอบ (ส่ง)

## 3. ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `AADSTS7000218` | ยังไม่เปิด **Allow public client flows** (ข้อ 1.3) |
| `AADSTS7000215` | client secret ไม่ถูกต้อง — ส่วนใหญ่เพราะคัดลอก **Secret ID** มาแทน **Value** หรือ secret หมดอายุแล้ว ให้สร้าง secret ใหม่ (ข้อ 2.3) แล้วกรอกใหม่ใน Carmen Blue |
| `AADSTS50020` / `AADSTS9002331` | **Supported account types** ไม่ตรงกับชนิดบัญชีที่ล็อกอิน (Hotmail ต้อง Personal Microsoft accounts) |
| `535 5.7.3 Authentication unsuccessful` | SMTP AUTH ของ mailbox ถูกปิด หรือยังไม่ได้รัน `New-ServicePrincipal` / `Add-MailboxPermission` (ข้อ 2.5) |
| "must reconnect its Microsoft account" | refresh token หมดอายุ (ไม่ได้ส่งเมล 90 วัน, เปลี่ยนรหัสผ่าน หรือถอนสิทธิ์) กด **เชื่อมต่อใหม่** |
| ล็อกอินแล้วถูกปฏิเสธ | ล็อกอินด้วยบัญชีอื่นที่ไม่ใช่ Mailbox ของโปรไฟล์ ให้ล็อกอินด้วยบัญชีที่ตรงกัน |
