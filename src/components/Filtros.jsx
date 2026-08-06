import React from 'react'
import { X } from 'lucide-react'

export function Select({ label, value, onChange, options, placeholder = 'Todos' }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-text-secondary font-medium">{label}</label>}
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value || null)}
        className="bg-bg-tertiary border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent-blue"
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

export function SearchInput({ label, value, onChange, placeholder = 'Buscar...' }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-text-secondary font-medium">{label}</label>}
      <div className="relative">
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-bg-tertiary border border-border-color text-text-primary text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-accent-blue pr-8"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

export function FiltrosBar({ children, onClear }) {
  return (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-bg-secondary border border-border-color rounded-xl mb-6">
      {children}
      {onClear && (
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary border border-border-color rounded-lg hover:bg-bg-tertiary transition-colors"
        >
          <X size={14} />
          Limpar
        </button>
      )}
    </div>
  )
}
