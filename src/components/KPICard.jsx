import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function KPICard({ title, value, subtitle, variacao, icon: Icon, iconColor = 'text-accent-blue', format = 'text' }) {
  const hasVariacao = variacao !== undefined && variacao !== null
  const varPositive = variacao > 0
  const varNeutral = variacao === 0

  return (
    <div className="bg-bg-secondary border border-border-color rounded-xl p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <p className="text-text-secondary text-sm font-medium">{title}</p>
        {Icon && (
          <div className={`p-2 rounded-lg bg-bg-tertiary ${iconColor}`}>
            <Icon size={18} />
          </div>
        )}
      </div>

      <p className={`text-2xl font-bold text-text-primary font-mono ${format === 'currency' ? '' : ''}`}>
        {value}
      </p>

      {subtitle && (
        <p className="text-text-secondary text-xs mt-1">{subtitle}</p>
      )}

      {hasVariacao && (
        <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${
          varNeutral ? 'text-text-secondary' : varPositive ? 'text-accent-green' : 'text-accent-red'
        }`}>
          {varNeutral ? <Minus size={14} /> : varPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{varPositive ? '+' : ''}{variacao.toFixed(1)}%</span>
          <span className="text-text-secondary font-normal text-xs">vs mês anterior</span>
        </div>
      )}
    </div>
  )
}
