import React from 'react'
import { ExternalLink, Database } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function SqlConsole() {
  return (
    <div className="p-4 md:p-6 animate-fade-in">
      <PageHeader title="SQL Console" subtitle="Acesso direto ao banco de dados" />

      <div className="bg-bg-secondary border border-border-color rounded-xl p-6 max-w-xl">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-accent-blue/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Database size={20} className="text-accent-blue" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">Console SQL migrado para Supabase</h3>
            <p className="text-sm text-text-secondary mb-4">
              O banco de dados agora é gerenciado pelo Supabase. Para executar queries SQL, use o SQL Editor do painel do Supabase.
            </p>
            <a
              href="https://supabase.com/dashboard/project/udhommjcoipiyrlyevev/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
            >
              <ExternalLink size={14} />
              Abrir SQL Editor no Supabase
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
