import React, { useState } from 'react'
import { ShieldCheck, ShieldAlert, Shield, Save } from 'lucide-react'
import { useData, useParams } from '../App'
import PageHeader from '../components/PageHeader'

function HashRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      <p className="font-mono text-xs text-text-primary bg-bg-tertiary px-3 py-2 rounded-lg break-all select-all">{value}</p>
    </div>
  )
}

function TabHash() {
  const { hashInfo, excelData } = useData()

  const statusBar = () => {
    if (!hashInfo) return null
    if (hashInfo.isValid === true) return (
      <div className="flex items-center gap-2 p-3 bg-accent-green/10 border border-accent-green/30 rounded-xl text-sm text-accent-green">
        <ShieldCheck size={16} /> Planilha validada — dados íntegros
      </div>
    )
    if (hashInfo.isValid === false) return (
      <div className="flex items-center gap-2 p-3 bg-accent-amber/10 border border-accent-amber/30 rounded-xl text-sm text-accent-amber">
        <ShieldAlert size={16} /> Planilha editada — os dados foram alterados em relação à versão original
      </div>
    )
    return (
      <div className="flex items-center gap-2 p-3 bg-bg-tertiary border border-border-color rounded-xl text-sm text-text-secondary">
        <Shield size={16} /> Aguardando primeiro carregamento para estabelecer referência
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {statusBar()}

      <div className="bg-bg-secondary border border-border-color rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Planilha em uso</h3>
        <HashRow label="Arquivo" value={excelData?.fileName} />
        <HashRow label="Hash atual (SHA-256)" value={hashInfo?.current} />
      </div>

      <div className="bg-bg-secondary border border-border-color rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">Referência original</h3>
        <HashRow label="Arquivo de referência" value={hashInfo?.nome} />
        <HashRow label="Hash original (SHA-256)" value={hashInfo?.original} />
      </div>

      <p className="text-xs text-text-secondary">
        A referência é estabelecida automaticamente no primeiro carregamento da planilha.
        Qualquer alteração posterior no arquivo é detectada e exibida em todas as telas.
      </p>
    </div>
  )
}

function TabSistema() {
  const { diasBloqueio, diasInativacao, curvaAMin, curvaBMin, updateParam } = useParams()
  const [form, setForm] = useState({
    dias_bloqueio: diasBloqueio,
    dias_inativacao: diasInativacao,
    curva_a_min: curvaAMin,
    curva_b_min: curvaBMin,
  })
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await updateParam('dias_bloqueio', form.dias_bloqueio)
    await updateParam('dias_inativacao', form.dias_inativacao)
    await updateParam('curva_a_min', form.curva_a_min)
    await updateParam('curva_b_min', form.curva_b_min)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function field(label, key, hint) {
    return (
      <div>
        <label className="block text-xs text-text-secondary mb-1">{label}</label>
        <input
          type="number"
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: Number(e.target.value) }))}
          className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
        />
        {hint && <p className="text-xs text-text-secondary/60 mt-1">{hint}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-sm">
      {field('Dias para Bloqueado', 'dias_bloqueio', 'Clientes sem compra acima deste limite são bloqueados')}
      {field('Dias para Inativo', 'dias_inativacao', 'Clientes sem compra acima deste limite são inativos')}
      {field('Faturamento mínimo Curva A (R$)', 'curva_a_min')}
      {field('Faturamento mínimo Curva B (R$)', 'curva_b_min')}

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-4 py-2 text-sm bg-accent-blue text-white rounded-lg hover:bg-accent-blue/80 transition-colors"
      >
        <Save size={14} />
        {saved ? 'Salvo!' : 'Salvar parâmetros'}
      </button>
    </div>
  )
}

export default function Parametros() {
  const [tab, setTab] = useState('hash')

  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <PageHeader title="Parâmetros" subtitle="Configurações do sistema e validação de integridade" />

      <div className="flex gap-1 mb-6 bg-bg-secondary border border-border-color rounded-xl p-1 w-fit">
        {[
          { key: 'hash', label: 'Validação de Planilha' },
          { key: 'sistema', label: 'Parâmetros do Sistema' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-accent-blue text-white font-medium'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'hash' && <TabHash />}
      {tab === 'sistema' && <TabSistema />}
    </div>
  )
}
