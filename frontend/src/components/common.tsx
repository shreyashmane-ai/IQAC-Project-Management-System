import type { ReactNode } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Link from '@tiptap/extension-link'
import { useEffect, useRef, useState } from 'react'

export function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
}) {
  const numeric = typeof value === 'number' || (typeof value === 'string' && /^-?\d[\d,]*/.test(value.trim()))
  return (
    <div className="stat">
      <div className="lbl">{label}</div>
      <div className="val">{numeric ? <CountUp value={value as string | number} /> : value}</div>
      {sub && <div className="muted2" style={styles.small}>{sub}</div>}
    </div>
  )
}

export function CountUp({ value }: { value: string | number }) {
  const raw = String(value)
  const m = raw.match(/^-?\d[\d,]*(\.\d+)?/)
  const target = m ? parseFloat(m[0].replace(/,/g, '')) : 0
  const suffix = m ? raw.slice(m[0].length) : ''
  const hasMatch = !!m
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [n, setN] = useState(target)
  const [prevTarget, setPrevTarget] = useState<number | null>(null)

  if (!reduceMotion && prevTarget !== target) {
    setPrevTarget(target)
    setN(0)
  }

  useEffect(() => {
    if (!hasMatch || reduceMotion) return
    const dur = 620
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [hasMatch, target, reduceMotion])

  if (!m) return <>{raw}</>

  const isInt = Number.isInteger(target)
  const text = (isInt ? Math.round(n) : n).toLocaleString('en-IN', { maximumFractionDigits: isInt ? 0 : 2 })
  return (
    <>
      {text}
      {suffix}
    </>
  )
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {initials}
    </span>
  )
}

export function Loading() {
  return <div className="loading">Loading…</div>
}

export function Err({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <div className="errorbox" style={styles.mb}>{msg}</div>
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="pagehead">
      <div style={{ minWidth: 0 }}>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {actions ? <div className="ph-actions">{actions}</div> : null}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 13px',
  border: '1px solid var(--border)',
  borderRadius: 12,
  fontSize: '13.5px',
  color: 'var(--text)',
  background: '#fff',
  outline: 0,
  transition: 'border-color .16s ease, box-shadow .16s ease',
}

export function TextInput({
  value,
  onChange,
  placeholder,
  style,
  type = 'text',
  label,
  id,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
  type?: string
  label?: string
  id?: string
  ariaLabel?: string
}) {
  const input = (
    <input
      type={type}
      id={id}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      style={{ ...inputStyle, ...(style || {}) }}
    />
  )
  if (!label) return input
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 6, font: 'inherit', ...(style || {}) }}>
      <span className="lbl" style={{ marginBottom: 0 }}>{label}</span>
      {input}
    </label>
  )
}

export function TSelect({
  value,
  onChange,
  options,
  style,
  allLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  style?: React.CSSProperties
  allLabel?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, ...(style || {}) }}
    >
      {allLabel ? <option value="">{allLabel}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function MultiSelect({
  value,
  onChange,
  options,
  placeholder,
  style,
  label,
  id,
}: {
  value: string[]
  onChange: (v: string[]) => void
  options: { value: string; label: string }[]
  placeholder?: string
  style?: React.CSSProperties
  label?: string
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = value
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is { value: string; label: string } => !!o)

  const control = (
    <div ref={wrapRef} style={{ position: 'relative', ...(style || {}) }}>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-label={label || placeholder || 'Select'}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '9px 12px',
          borderRadius: 10,
          border: `1px solid ${open ? '#3b82f6' : 'var(--border-strong)'}`,
          background: '#fff',
          color: selected.length ? 'var(--text)' : 'var(--muted2)',
          fontSize: 14,
          textAlign: 'left',
          cursor: 'pointer',
          boxShadow: open ? '0 0 0 3px rgba(37,99,235,.12)' : 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected.length ? selected.map((o) => o.label).join(', ') : placeholder || 'Select…'}
        </span>
        <span style={{ display: 'inline-flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          {selected.length > 0 && (
            <span style={{ background: '#2563eb', color: '#fff', borderRadius: 999, padding: '1px 7px', fontSize: 12, fontWeight: 600 }}>
              {selected.length}
            </span>
          )}
          <span style={{ fontSize: 10, color: 'var(--muted2)' }}>{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          aria-multiselectable="true"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            zIndex: 20,
            maxHeight: 220,
            overflowY: 'auto',
            border: '1px solid var(--border-strong)',
            borderRadius: 12,
            background: '#fff',
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            padding: 6,
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: 10, fontSize: 13, color: 'var(--muted2)' }}>No options</div>
          ) : (
            options.map((o) => {
              const on = value.includes(o.value)
              return (
                <label
                  key={o.value}
                  role="option"
                  aria-selected={on}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 8px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: on ? '#eff6ff' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
                    style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{o.label}</span>
                </label>
              )
            })
          )}
        </div>
      )}
    </div>
  )

  if (!label) return control
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="lbl" style={{ marginBottom: 0 }}>{label}</span>
      {control}
    </div>
  )
}

const richCSS = `
  .rte-toolbar { display: flex; flex-wrap: wrap; gap: 2px; padding: 7px 9px; border-bottom: 1px solid var(--border); background: #f7fafc; border-radius: 12px 12px 0 0; }
  .rte-toolbar button { border: 0; background: transparent; color: var(--text); border-radius: 8px; cursor: pointer; width: 32px; height: 30px; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-family: inherit; transition: background .14s ease, color .14s ease; }
  .rte-toolbar button:hover { background: rgba(37,99,235,.12); color: #2563eb; }
  .rte-toolbar button.is-active { background: #2563eb; color: #fff; }
  .rte-toolbar .rte-sep { width: 1px; height: 20px; background: var(--border); margin: 5px 5px; }
  .rte-content { padding: 12px 14px; min-height: 160px; font-size: 14px; line-height: 1.6; color: var(--text); outline: 0; }
  .rte-wrap { border: 1px solid var(--border); border-radius: 12px; background: #fff; transition: border-color .16s ease, box-shadow .16s ease; }
  .rte-wrap:focus-within { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
  .rte-content p { margin: 0 0 0.55em; }
  .rte-content p:last-child { margin-bottom: 0; }
  .rte-content h1,.rte-content h2,.rte-content h3 { margin: 0.6em 0 0.35em; line-height: 1.3; font-weight: 700; }
  .rte-content h1 { font-size: 1.5em; } .rte-content h2 { font-size: 1.3em; } .rte-content h3 { font-size: 1.15em; }
  .rte-content ul,.rte-content ol { padding-left: 1.4em; margin: 0 0 0.55em; }
  .rte-content blockquote { border-left: 3px solid #bfdbfe; background: #f8fafc; margin: 0.6em 0; padding: 8px 12px; border-radius: 0 8px 8px 0; }
  .rte-content code { background: #eef2f7; color: #2563eb; padding: 2px 5px; border-radius: 5px; font-size: 0.9em; }
  .rte-content pre { background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 10px; overflow: auto; margin: 0.6em 0; }
  .rte-content a { color: #2563eb; text-decoration: underline; }
  .rte-content img { max-width: 100%; border-radius: 10px; }
  .rte-content p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--muted); float: left; height: 0; pointer-events: none; }
`

function ToolbarBtn({ label, onClick, active, title }: { label: string; onClick: () => void; active?: boolean; title: string }) {
  return (
    <button type="button" title={title} aria-pressed={active || false} className={active ? 'is-active' : ''} onClick={onClick} style={{ fontWeight: 700 }}>
      {label}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  style,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder || 'Describe the program…' }),
    ],
    content: value || '',
    onUpdate: ({ editor: e }: { editor: Editor }) => onChange(e.getHTML()),
  })

  useEffect(() => {
    if (!editor || editor.getHTML() === (value || '')) return
    editor.commands.setContent(value || '')
  }, [value, editor])

  if (!editor) return <div className="rte-wrap" style={style}><div className="rte-content" style={{ minHeight: 160 }} /></div>

  const setColor = (hex: string) => editor.chain().focus().setColor(hex).run()
  const unsetColor = () => editor.chain().focus().unsetColor().run()

  return (
    <>
      <style>{richCSS}</style>
      <div className="rte-wrap" style={style}>
        <div className="rte-toolbar">
          <ToolbarBtn title="Bold" label="B" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
          <ToolbarBtn title="Italic" label="I" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
          <ToolbarBtn title="Underline" label="U" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} />
          <ToolbarBtn title="Strikethrough" label="S" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} />
          <div className="rte-sep" />
          <ToolbarBtn title="Heading 1" label="H1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} />
          <ToolbarBtn title="Heading 2" label="H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} />
          <ToolbarBtn title="Heading 3" label="H3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} />
          <div className="rte-sep" />
          <ToolbarBtn title="Bullet list" label="•" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} />
          <ToolbarBtn title="Numbered list" label="1." onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
          <ToolbarBtn title="Quote" label="❝" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} />
          <ToolbarBtn title="Code" label="<>" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} />
          <div className="rte-sep" />
          <ToolbarBtn title="Align left" label="⇤" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} />
          <ToolbarBtn title="Align center" label="≣" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} />
          <ToolbarBtn title="Align right" label="⇥" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} />
          <div className="rte-sep" />
          <ToolbarBtn title="Link" label="🔗" onClick={() => {
            const prev = editor.getAttributes('link').href as string | undefined
            const url = window.prompt('Link URL', prev || 'https://')
            if (url === null) return
            if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
          }} active={editor.isActive('link')} />
          <input
            type="color"
            title="Text color"
            onChange={(e) => setColor(e.target.value)}
            style={{ width: 26, height: 26, border: 0, background: 'transparent', cursor: 'pointer', padding: 0 }}
          />
          <button type="button" title="Reset color" onClick={unsetColor} style={{ fontWeight: 700 }}>A̶</button>
        </div>
        <EditorContent editor={editor} className="rte-content" />
      </div>
    </>
  )
}

export function Btn({
  onClick,
  children,
  kind = 'primary',
  disabled,
  style,
  type = 'button',
}: {
  onClick?: () => void
  children: ReactNode
  kind?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  style?: React.CSSProperties
  type?: 'button' | 'submit'
}) {
  const base: React.CSSProperties =
    kind === 'primary'
      ? {
          background: 'linear-gradient(135deg,#3b82f6 0%,#2563eb 55%,#1d4ed8 100%)',
          color: '#fff',
          border: '1px solid transparent',
          boxShadow: '0 8px 18px -8px rgba(29,78,216,.6)',
        }
      : kind === 'danger'
        ? {
            background: 'var(--danger-soft)',
            color: 'var(--danger-d)',
            border: '1px solid rgba(220,38,38,.25)',
          }
        : {
            background: '#fff',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (kind === 'primary') e.currentTarget.style.filter = 'brightness(1.06)'
      }}
      onMouseLeave={(e) => {
        if (kind === 'primary') e.currentTarget.style.filter = ''
      }}
      style={{
        ...base,
        borderRadius: 12,
        padding: '10px 15px',
        minHeight: 42,
        fontSize: '13px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'filter .15s ease, background .15s ease, box-shadow .15s ease, transform .1s ease',
        ...(style || {}),
      }}
    >
      {children}
    </button>
  )
}

const rowIcons: Record<string, ReactNode> = {
  edit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  ),
  del: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
    </svg>
  ),
  ok: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4 12 14.01l-3-3" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
}

export function RowBtn({
  onClick,
  children,
  kind = 'edit',
  icon,
  disabled,
  title,
}: {
  onClick?: () => void
  children: ReactNode
  kind?: 'edit' | 'del' | 'ok' | 'plain'
  icon?: 'chart'
  disabled?: boolean
  title?: string
}) {
  const ico = icon ? rowIcons[icon] : rowIcons[kind]
  return (
    <button
      type="button"
      className={`row-btn row-btn--${kind}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {ico}
      {children}
    </button>
  )
}

export function Badge({ value, tone }: { value: string; tone?: string }) {
  return <span className={`badge ${tone || ''}`}>{value}</span>
}

const styles: Record<string, React.CSSProperties> = {
  small: { fontSize: '12px', marginTop: 2 },
  mb: { marginBottom: '1rem' },
}
