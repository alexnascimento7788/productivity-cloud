import React, { useMemo, useState } from 'react'
import { Download, ChevronDown, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useData, useParams, filterRowsByRole } from '../App'
import {
  processExcelData, calcEquipesData, calcEquipeVendedores,
  formatCurrency, formatCurrencyAbbr, formatPct, exportExcel,
} from '../services/dataService'
import PageHeader from '../components/PageHeader'
import { FiltrosBar, Select } from '../components/Filtros'

export default function Equipes() {
  const { session } = useAuth()
  const { excelData, equipesList } = useData()
  const { diasBloqueio, diasInativacao } = useParams()
  const navigate = useNavigate()

  const [filterGr, setFilterGr] = useState(null)
  const [expandedGr, setExpandedGr] = useState(null)

  const { rows, meses } = useMemo(() => {
    if (!excelData) return { rows: [], meses: [] }
    const processed = processExcelData(excelData.data) || { rows: [], meses: [] }
    return { rows: filterRowsByRole(processed.rows, session), meses: processed.meses }
  }, [excelData, session])

  const equipesData = useMemo(() => {
    if (!meses.length) return []
    let data = calcEquipesData(rows, meses, equipesList, diasBloqueio, diasInativacao)
    if (filterGr) data = data.filter(e => e.gr === filterGr)
    return data
  }, [rows, meses, filterGr, diasBloqueio, diasInativacao])

  const grOptions = useMemo(() => {
    return [...new Set(rows.map(r => r.gr))].sort().map(gr => ({
      value: gr,
      label: equipesList.find(e => e.cod_equipe === gr)?.nome || 'Equipe ' + gr,
    }))
  }, [rows, equipesList])

  const today = new Date().toISOString().slice(0, 10)

  function handleExportAll() {
    exportExcel(equipesData.map(e => ({
      'Equipe (Cód)': e.gr,
      'Nome': e.nome,
      'Vendedores': e.vendedoresCount,
      'Municípios': e.municipiosCount,
      'Total Clientes': e.totalClientes,
      'Ativos': e.ativos,
      'Bloqueados': e.bloqueados,
      'Inativos': e.inativos,
      'Fat. Mês Atual': e.fatMesAtual,
      'Fat. 12M': e.fat12M,
      'Ticket Médio': e.ticketMedio,
      'Positivação %': +e.positivacaoPct.toFixed(1),
    })), `equipes_${today}.xlsx`)
  }

  if (!excelData) return <div className="p-4 md:p-6 text-text-secondary">Sem dados carregados.</div>

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <PageHeader
        title="Equipes"
        subtitle={`${equipesData.length} equipes`}
        action={
          <button onClick={handleExportAll} className="flex items-center gap-2 px-4 py-2 text-sm bg-bg-secondary border border-border-color rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors">
            <Download size={14} /> Exportar Excel
          </button>
        }
      />

      <FiltrosBar onClear={() => setFilterGr(null)}>
        <Select label="Equipe" value={filterGr} onChange={setFilterGr} options={grOptions} />
      </FiltrosBar>

      {/* Cards de equipe */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {equipesData.map(equipe => (
          <EquipeCard
            key={equipe.gr}
            equipe={equipe}
            rows={rows}
            meses={meses}
            equipesList={equipesList}
            diasBloqueio={diasBloqueio}
            diasInativacao={diasInativacao}
            expanded={expandedGr === equipe.gr}
            onToggle={() => setExpandedGr(expandedGr === equipe.gr ? null : equipe.gr)}
            navigate={navigate}
            today={today}
          />
        ))}
      </div>
    </div>
  )
}

function EquipeCard({ equipe, rows, meses, equipesList, diasBloqueio, diasInativacao, expanded, onToggle, navigate, today }) {
  const vendedores = useMemo(() => {
    if (!expanded) return []
    return calcEquipeVendedores(rows, meses, equipe.gr, equipesList, diasBloqueio, diasInativacao)
  }, [expanded, rows, meses, equipe.gr, equipesList, diasBloqueio, diasInativacao])

  function handleExportVendedores() {
    exportExcel(vendedores.map(v => ({
      'Vendedor': v.nome, 'RCA': v.rca,
      'Municípios': v.municipiosCount,
      'Total Clientes': v.totalClientes,
      'Ativos': v.ativos, 'Bloqueados': v.bloqueados, 'Inativos': v.inativos,
      'Fat. Mês Atual': v.fatMesAtual, 'Fat. 12M': v.fat12M,
      'Ticket Médio': v.ticketMedio,
      'Positivação %': +v.positivacaoPct.toFixed(1),
    })), `equipe_${equipe.gr}_vendedores_${today}.xlsx`)
  }

  return (
    <div className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-text-primary">{equipe.nome}</h3>
            <p className="text-xs text-text-secondary">Cód: {equipe.gr}</p>
          </div>
          <span className="text-xs bg-accent-blue/10 text-accent-blue px-2 py-1 rounded-full">
            {formatPct(equipe.positivacaoPct)} positivação
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat icon="👤" label="Vendedores" value={equipe.vendedoresCount} />
          <Stat icon="🏙️" label="Municípios" value={equipe.municipiosCount} />
          <StatLink
            icon="👥" label="Total Clientes" value={equipe.totalClientes}
            onClick={() => navigate(`/clientes?gr=${equipe.gr}`)}
          />
          <div className="bg-bg-tertiary rounded-lg p-2.5 text-xs">
            <span className="text-text-secondary block mb-1">Status</span>
            <div className="space-y-0.5">
              <button onClick={() => navigate(`/clientes?gr=${equipe.gr}&status=ativo`)} className="flex justify-between w-full hover:text-accent-green text-text-primary">
                <span className="text-text-secondary">🟢 Ativos</span>
                <span className="font-semibold">{equipe.ativos}</span>
              </button>
              <button onClick={() => navigate(`/clientes?gr=${equipe.gr}&status=bloqueado`)} className="flex justify-between w-full hover:text-accent-amber text-text-primary">
                <span className="text-text-secondary">🟡 Bloqueados</span>
                <span className="font-semibold">{equipe.bloqueados}</span>
              </button>
              <button onClick={() => navigate(`/clientes?gr=${equipe.gr}&status=inativo`)} className="flex justify-between w-full hover:text-accent-red text-text-primary">
                <span className="text-text-secondary">🔴 Inativos</span>
                <span className="font-semibold">{equipe.inativos}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-border-color pt-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary">💰 Fat. Mês Atual</span>
            <span className="text-text-primary font-semibold">{formatCurrencyAbbr(equipe.fatMesAtual)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary">💰 Fat. 12M</span>
            <span className="text-text-primary font-semibold">{formatCurrencyAbbr(equipe.fat12M)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary">📊 Ticket Médio</span>
            <span className="text-text-primary font-semibold">{formatCurrency(equipe.ticketMedio)}</span>
          </div>
        </div>
      </div>

      {/* Expandir vendedores */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-2.5 border-t border-border-color text-xs text-text-secondary hover:bg-bg-tertiary transition-colors"
      >
        <span>Ver {equipe.vendedoresCount} vendedor{equipe.vendedoresCount !== 1 ? 'es' : ''}</span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {expanded && (
        <div className="border-t border-border-color">
          <div className="flex justify-end p-3 border-b border-border-color/50">
            <button onClick={handleExportVendedores} className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary">
              <Download size={12} /> Exportar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-color/50">
                  {['Vendedor', 'RCA', 'Mun.', 'Clientes', 'Ativos', 'Inativos', 'Fat. Mês', 'Fat. 12M', 'Ticket', 'Posit.%'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-text-secondary font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendedores.map(v => (
                  <tr key={v.rca} className="border-b border-border-color/30 hover:bg-bg-tertiary/30">
                    <td className="px-3 py-2 text-text-primary font-medium truncate max-w-[120px]">{v.nome}</td>
                    <td className="px-3 py-2 text-text-secondary font-mono">{v.rca}</td>
                    <td className="px-3 py-2 text-text-secondary">{v.municipiosCount}</td>
                    <td className="px-3 py-2 text-text-secondary">
                      <button onClick={() => navigate(`/clientes?rca=${v.rca}`)} className="hover:underline">{v.totalClientes}</button>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => navigate(`/clientes?rca=${v.rca}&status=ativo`)} className="text-accent-green hover:underline">{v.ativos}</button>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => navigate(`/clientes?rca=${v.rca}&status=inativo`)} className="text-accent-amber hover:underline">{v.inativos + v.bloqueados}</button>
                    </td>
                    <td className="px-3 py-2 text-text-primary font-mono">{formatCurrencyAbbr(v.fatMesAtual)}</td>
                    <td className="px-3 py-2 text-text-secondary font-mono">{formatCurrencyAbbr(v.fat12M)}</td>
                    <td className="px-3 py-2 text-text-secondary font-mono">{formatCurrencyAbbr(v.ticketMedio)}</td>
                    <td className="px-3 py-2 text-text-secondary">{v.positivacaoPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="bg-bg-tertiary rounded-lg p-2.5 text-xs">
      <span className="text-text-secondary block mb-0.5">{icon} {label}</span>
      <span className="text-text-primary font-bold text-base">{value?.toLocaleString('pt-BR')}</span>
    </div>
  )
}

function StatLink({ icon, label, value, onClick }) {
  return (
    <button onClick={onClick} className="bg-bg-tertiary rounded-lg p-2.5 text-xs text-left hover:border hover:border-accent-blue/40 transition-colors">
      <span className="text-text-secondary block mb-0.5">{icon} {label}</span>
      <span className="text-text-primary font-bold text-base hover:text-accent-blue">{value?.toLocaleString('pt-BR')}</span>
    </button>
  )
}
