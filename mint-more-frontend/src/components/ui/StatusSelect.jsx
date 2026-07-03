import { useEffect, useRef, useState } from 'react'
import { StatusBadge } from './StatusBadge'
import { TASK_STATUS_OPTIONS, statusLabel } from './statusMeta'
import Icon from './Icon'

export default function StatusSelect({ value, onChange, disabled = false, options = TASK_STATUS_OPTIONS }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = event => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="status-select" ref={ref}>
      <button
        type="button"
        className="status-select-trigger"
        disabled={disabled}
        onClick={() => setOpen(current => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <StatusBadge status={value}>{statusLabel(value)}</StatusBadge>
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div className="status-select-menu" role="listbox">
          {options.map(option => (
            <button
              key={option}
              type="button"
              className="status-select-option"
              role="option"
              aria-selected={option === value}
              onClick={() => {
                onChange(option)
                setOpen(false)
              }}
            >
              <StatusBadge status={option}>{statusLabel(option)}</StatusBadge>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
