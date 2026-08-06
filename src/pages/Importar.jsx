import React from 'react'
import { useAuth } from '../App'
import PageHeader from '../components/PageHeader'
import ImportPlanilha from '../components/ImportPlanilha'
import ImportGeoCsv from '../components/ImportGeoCsv'

export default function Importar() {
  const { session, companyFlags } = useAuth()

  return (
    <div className="p-4 md:p-6 animate-fade-in space-y-8">
      <div>
        <PageHeader title="Importar Planilha" />
        <div className="max-w-2xl">
          <ImportPlanilha session={session} />
        </div>
      </div>

      {session.role === 'admin' && companyFlags?.geoVendasCidadesHabilitado && (
        <div>
          <PageHeader title="Importar Vendas Cidades" />
          <div className="max-w-2xl">
            <ImportGeoCsv session={session} onImported={() => {}} />
          </div>
        </div>
      )}
    </div>
  )
}
