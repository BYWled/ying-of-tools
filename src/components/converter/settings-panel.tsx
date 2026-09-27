import { useEffect, useMemo } from 'react'
import { SimpleSelect } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { FieldDef, Settings } from '@/config/types'

interface SettingsPanelProps {
  fields: FieldDef[]
  settings: Settings
  files: File[]
  onChange: (key: string, value: string | number | boolean) => void
}

export function SettingsPanel({ fields, settings, files, onChange }: SettingsPanelProps) {
  const visible = useMemo(() => fields.filter((f) => !f.showIf || f.showIf(settings)), [fields, settings])

  return (
    <div className="space-y-4">
      {visible.map((field) => (
        <FieldRow key={field.key} field={field} settings={settings} files={files} onChange={onChange} />
      ))}
    </div>
  )
}

function resolveOptions(
  field: FieldDef,
  files: File[],
): { value: string; label: string }[] {
  if (typeof field.options === 'function') return field.options(files)
  return field.options ?? []
}

/** 下拉字段：动态选项（随文件变化）在当前值失效时自动回选第一项 */
function SelectField({
  field,
  settings,
  files,
  onChange,
}: {
  field: FieldDef
  settings: Settings
  files: File[]
  onChange: SettingsPanelProps['onChange']
}) {
  const options = useMemo(() => resolveOptions(field, files), [field, files])
  const value = String(settings[field.key] ?? '')
  const signature = options.map((o) => o.value).join(',')

  useEffect(() => {
    if (signature && !signature.split(',').includes(value)) {
      onChange(field.key, options[0].value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return (
    <div className="space-y-1.5">
      <Label>{field.label}</Label>
      <SimpleSelect
        value={value}
        onChange={(v) => onChange(field.key, v)}
        options={options}
        placeholder={field.placeholder}
      />
      {field.hint && <p className="text-muted-foreground text-xs">{field.hint}</p>}
    </div>
  )
}

function FieldRow({
  field,
  settings,
  files,
  onChange,
}: {
  field: FieldDef
  settings: Settings
  files: File[]
  onChange: SettingsPanelProps['onChange']
}) {
  const value = settings[field.key]

  if (field.type === 'select') {
    return <SelectField field={field} settings={settings} files={files} onChange={onChange} />
  }

  if (field.type === 'slider') {
    const min = field.min ?? 0
    const max = field.max ?? 100
    const step = field.step ?? 1
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>{field.label}</Label>
          <span className="text-muted-foreground font-mono text-xs">
            {Number(value)}
            {field.suffix ?? ''}
          </span>
        </div>
        <Slider
          value={[Number(value)]}
          min={min}
          max={max}
          step={step}
          onValueChange={([v]) => onChange(field.key, v)}
        />
        {field.hint && <p className="text-muted-foreground text-xs">{field.hint}</p>}
      </div>
    )
  }

  if (field.type === 'toggle') {
    return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label>{field.label}</Label>
          {field.hint && <p className="text-muted-foreground mt-1 text-xs">{field.hint}</p>}
        </div>
        <Switch checked={Boolean(value)} onCheckedChange={(v) => onChange(field.key, v)} />
      </div>
    )
  }

  // text / password
  return (
    <div className="space-y-1.5">
      <Label>{field.label}</Label>
      <Input
        type={field.type === 'password' ? 'password' : 'text'}
        value={String(value ?? '')}
        placeholder={field.placeholder}
        onChange={(e) => onChange(field.key, e.target.value)}
      />
      {field.hint && <p className="text-muted-foreground text-xs">{field.hint}</p>}
    </div>
  )
}
