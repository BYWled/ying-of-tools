import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { ToolShell } from '@/components/tool-shell'

/** GB 11643-1999 校验位：7/9/10/5/8/4/2/1/6/3/7/9/10/5/8/4/2 mod 11 → 映射 1 0 X 9 8 7 6 5 4 3 2 */
const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
const CHECKS = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']

const REGION: Record<string, string> = {
  '11': '北京市', '12': '天津市', '13': '河北省', '14': '山西省', '15': '内蒙古自治区',
  '21': '辽宁省', '22': '吉林省', '23': '黑龙江省', '31': '上海市', '32': '江苏省',
  '33': '浙江省', '34': '安徽省', '35': '福建省', '36': '江西省', '37': '山东省',
  '41': '河南省', '42': '湖北省', '43': '湖南省', '44': '广东省', '45': '广西壮族自治区',
  '46': '海南省', '50': '重庆市', '51': '四川省', '52': '贵州省', '53': '云南省',
  '54': '西藏自治区', '61': '陕西省', '62': '甘肃省', '63': '青海省', '64': '宁夏回族自治区',
  '65': '新疆维吾尔自治区', '71': '台湾省', '81': '香港特别行政区', '82': '澳门特别行政区',
}

function analyze(raw: string) {
  const id = raw.trim().toUpperCase()
  if (!/^\d{17}[\dX]$/.test(id)) return { ok: false as const, msg: '格式无效：应为 18 位（最后一位可为 X）' }

  let sum = 0
  for (let i = 0; i < 17; i++) sum += Number(id[i]) * WEIGHTS[i]
  const expect = CHECKS[sum % 11]
  const valid = id[17] === expect

  const year = Number(id.slice(6, 10))
  const month = Number(id.slice(10, 12))
  const day = Number(id.slice(12, 14))
  const date = new Date(year, month - 1, day)
  const dateValid =
    year >= 1900 && year <= new Date().getFullYear() &&
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day

  const seq = Number(id.slice(14, 17))
  const gender = seq % 2 === 1 ? '男' : '女'
  const region = REGION[id.slice(0, 2)] ?? '未知地区代码'
  const age = dateValid ? Math.floor((Date.now() - date.getTime()) / 31557600000) : null

  return { ok: true as const, valid, expect, actual: id[17], dateValid, date, gender, region, age }
}

export default function IdCardPage() {
  const [id, setId] = useState('11010119900307' + '86' + '1')

  const r = useMemo(() => (id.trim() ? analyze(id) : null), [id])

  return (
    <ToolShell
      title="身份证号校验"
      desc="按 GB 11643 标准校验校验位，解析归属省份、出生日期与性别（本工具仅做校验与解析，不提供号码生成）"
    >
      <div className="rounded-xl border p-4">
        <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="输入 18 位身份证号码" className="font-mono text-base tracking-widest" />
        {r && (
          r.ok ? (
            <>
              <div
                className={`mt-4 rounded-lg border p-4 text-center ${r.valid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}
              >
                <p className={`text-lg font-semibold ${r.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                  {r.valid ? '✓ 校验位正确，号码格式有效' : '✗ 校验位不正确'}
                </p>
                {!r.valid && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    末位应为 <code className="font-mono font-semibold">{r.expect}</code>，实际为 <code className="font-mono font-semibold">{r.actual}</code>
                  </p>
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <InfoCard label="归属省份（前 2 位）" value={r.region} />
                <InfoCard label="性别（第 17 位）" value={r.gender} />
                <InfoCard
                  label="出生日期"
                  value={r.dateValid ? r.date.toLocaleDateString('zh-CN') : '日期无效'}
                />
                <InfoCard label="年龄" value={r.age !== null ? `${r.age} 岁` : '—'} />
              </div>
            </>
          ) : (
            <p className="text-destructive mt-3 text-sm">{r.msg}</p>
          )
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        身份证号包含个人敏感信息，本页面不联网、不存储，校验仅在浏览器内存中完成。
      </p>
    </ToolShell>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-0.5 text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}
