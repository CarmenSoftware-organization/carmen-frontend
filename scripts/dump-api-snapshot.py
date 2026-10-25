# scripts/dump-api-snapshot.py  (ใน carmen-frontend)
"""ดัมพ์ response ของทุก endpoint เก็บเป็น golden snapshot ก่อนแก้ contract
ใช้: cd /tmp/carmen-contract-baseline && python3 <path>/scripts/dump-api-snapshot.py
"""
import json, subprocess, re, pathlib

TOKEN = open('token.txt').read().strip()
APPID = '9c83fd4b-ce3f-4de2-a522-349ad1280b10'
BASE = 'http://localhost:4000'
BU = 'T02'
out = pathlib.Path('api')
out.mkdir(exist_ok=True)


def get(path):
    raw = subprocess.run(
        ['curl', '-s', BASE + path,
         '-H', f'Authorization: Bearer {TOKEN}',
         '-H', f'x-app-id: {APPID}'],
        capture_output=True, text=True).stdout
    try:
        return json.loads(raw)
    except Exception:
        return {'_raw': raw[:400]}


def save(name, payload, url):
    payload['_url'] = url
    (out / name).write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True))


ENDPOINTS = [
    ('po', f'/api/{BU}/purchase-orders'),
    ('grn', f'/api/{BU}/good-received-notes'),
    ('cn', f'/api/{BU}/credit-notes'),
    ('si', f'/api/{BU}/stock-ins'),
    ('so', f'/api/{BU}/stock-outs'),
    ('rfp', f'/api/{BU}/request-for-pricings'),
    ('product', f'/api/config/{BU}/products'),
    ('pricelist', f'/api/config/{BU}/pricelists'),
]

for name, base in ENDPOINTS:
    list_url = base + '?perpage=5'
    save(f'{name}.list.json', get(list_url), list_url)
    m = re.search(r'"id"\s*:\s*"([0-9a-f-]{36})"', json.dumps(get(list_url)))
    if not m:
        print(f'{name}: ไม่มีข้อมูล ข้าม detail')
        continue
    detail_url = f'{base}/{m.group(1)}'
    save(f'{name}.detail.json', get(detail_url), detail_url)
    print(f'{name}: ok')

# PR list เป็น multi-BU endpoint ที่ 403 กับ token นี้ — ใช้ for-po หา id แทน
pr = get(f'/api/{BU}/purchase-requests/for-po?perpage=1')
m = re.search(r'"id"\s*:\s*"([0-9a-f-]{36})"', json.dumps(pr))
if m:
    url = f'/api/{BU}/purchase-requests/{m.group(1)}'
    save('pr.detail.json', get(url), url)
    print('pr: ok')

# SR ใช้ route คนละแบบ: list ข้าม BU ต้องส่ง bu_code เป็น query param
# และ items ห่ออยู่ที่ data[0].data — ไม่มี route GET /:bu/store-requisitions
sr_list_url = f'/api/store-requisitions?perpage=5&bu_code={BU}'
sr_list = get(sr_list_url)
save('sr.list.json', sr_list, sr_list_url)
try:
    sr_id = sr_list['data'][0]['data'][0]['id']
except (KeyError, IndexError, TypeError):
    sr_id = None
    print('sr: ไม่มีข้อมูล ข้าม detail')
if sr_id:
    sr_detail_url = f'/api/{BU}/store-requisitions/{sr_id}'
    save('sr.detail.json', get(sr_detail_url), sr_detail_url)
    print('sr: ok')
