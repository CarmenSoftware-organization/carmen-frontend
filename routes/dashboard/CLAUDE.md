# routes/dashboard/

## Backend bug: `GET /api/me/dashboard-widgets` คืน 500 (ไม่ใช่บั๊กฝั่ง frontend)

`GET /api/me/dashboard-widgets?bu_code=T02` คืน 500 จากตัว gateway เอง
(ยืนยันแล้วว่าเหมือนกันทั้งยิงตรงและผ่าน proxy) หน้า Dashboard degrade อย่างนุ่มนวลอยู่แล้ว
ให้แจ้งทีม carmen-turborepo-backend อย่าไปไล่แก้ฝั่งนี้
