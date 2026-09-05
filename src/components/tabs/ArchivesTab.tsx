import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FileText, Download, ShieldCheck, Search, Calendar, Printer } from 'lucide-react';
import { ArchiveDoc } from '../../types';

interface ArchivesTabProps {
  highlightedDocId?: string;
}

export const ArchivesTab: React.FC<ArchivesTabProps> = ({ highlightedDocId }) => {
  const { archiveDocs, bilans } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PV' | 'REGLEMENT' | 'BILAN_FINANCIER'>('ALL');

  const handlePrintArchiveDoc = (doc: ArchiveDoc) => {
    const isBilan = doc.type === 'BILAN_FINANCIER' || doc.title.toLowerCase().includes('bilan');
    const displayTitle = isBilan
      ? 'Bilan Financier (Global (Intégralité des données))'
      : doc.title;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Veuillez autoriser les popups pour imprimer le document.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>${displayTitle} - E-ROUAMA</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; background: #fff; }
          .header { text-align: center; border-bottom: 3px double #065f46; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { font-size: 18pt; color: #065f46; margin: 0 0 5px 0; text-transform: uppercase; font-weight: 800; }
          .header h2 { font-size: 12pt; color: #d97706; margin: 0 0 5px 0; font-weight: 700; }
          .header p { font-size: 9pt; color: #64748b; margin: 0; }
          .doc-title-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 20px; }
          .doc-title-box h3 { margin: 0; font-size: 14pt; color: #0f172a; font-weight: 800; text-transform: uppercase; }
          .content-body { font-size: 10pt; color: #334155; white-space: pre-wrap; background: #fafafa; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; min-height: 250px; }
          .footer { margin-top: 40px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/LOGOPRO.png" alt="Logo E-ROUAMA" style="height:55px; margin-bottom:8px; object-fit:contain;" />
          <h1>ASSOCIATION ÉLÈVES & ÉTUDIANTS ROUAMA (E-ROUAMA)</h1>
          <h2>COFFRE-FORT NUMÉRIQUE & ARCHIVES OFFICIELLES</h2>
          <p>Document Certifié • Copie d'Archivage Officielle</p>
        </div>

        <div class="doc-title-box">
          <h3>${displayTitle}</h3>
          <p style="margin:5px 0 0 0; font-size:9pt; color:#64748b;">Auteur: ${doc.author} • Date: ${doc.date}</p>
        </div>

        <div class="content-body">${doc.content}</div>

        <div class="footer">
          Document extrait du coffre-fort officiel E-ROUAMA le ${new Date().toLocaleString('fr-FR')}
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  // Combine archiveDocs and published/archived bilans ensuring no duplicates
  const allDocsList: ArchiveDoc[] = [...archiveDocs];
  (bilans || []).forEach(b => {
    if ((b.archivedBySecretariat || b.publishedByCom || b.ackByCom) && !allDocsList.some(a => a.id.includes(b.id))) {
      allDocsList.push({
        id: 'ARCH-BILAN-' + b.id,
        title: 'Bilan Financier (Global (Intégralité des données))',
        type: 'BILAN_FINANCIER',
        content: `Document Officiel Bi-Signé • Archivé\n\nSynthèse financière globale certifiée par le Trésorier Général et le Payor pour la période (${b.period}).`,
        author: 'TRÉSORIER & PAYOR',
        date: b.date || new Date().toLocaleDateString('fr-FR'),
        status: 'ARCHIVED',
        ackByCom: true,
        sentToComBySecretariat: true,
        archivedBySecretariat: true,
      });
    }
  });

  // Filter archived docs
  const visibleDocs = allDocsList.filter(doc => {
    // Must be either ACKNOWLEDGED_COM, PUBLISHED_BY_COM, or ARCHIVED
    const isPublic = doc.ackByCom || doc.status === 'PUBLISHED_BY_COM' || doc.status === 'ARCHIVED';
    if (!isPublic) return false;

    if (filterType !== 'ALL' && doc.type !== filterType) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return doc.title.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q);
    }

    return true;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-white rounded-[3rem] p-6 sm:p-8 shadow-sm border border-[#355E3B]/10 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-2xl font-black text-[#355E3B] flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#E67E22]" />
              <span>Coffre-Fort & Archives Officieuses E-ROUAMA</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Procès-Verbaux (PV), Règlement Intérieur, Statuts et Bilans Financiers certifiés.
            </p>
          </div>

          {/* Filter & Search Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Rechercher un document..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-emerald-50/60 border border-emerald-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-forest-moss w-full"
              />
            </div>

            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="bg-emerald-50/60 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold text-forest-moss focus:outline-none w-full sm:w-auto"
            >
              <option value="ALL">Tous les documents</option>
              <option value="PV">Procès-Verbaux (PV)</option>
              <option value="REGLEMENT">Règlement Intérieur</option>
              <option value="BILAN_FINANCIER">Bilans Financiers</option>
            </select>
          </div>
        </div>

        {visibleDocs.length === 0 ? (
          <div className="text-center py-12 bg-emerald-50/30 rounded-3xl border border-dashed border-emerald-200 text-slate-500 text-sm">
            Aucun document n'est archivé dans le coffre-fort pour l'instant (Archives vierges).
          </div>
        ) : (
          <div className="space-y-4">
            {visibleDocs.map(doc => {
              const isBilan = doc.type === 'BILAN_FINANCIER' || doc.title.toLowerCase().includes('bilan');
              const displayTitle = isBilan
                ? 'Bilan Financier (Global (Intégralité des données))'
                : doc.title;
              const displaySubtitle = isBilan
                ? 'Document Officiel Bi-Signé • Archivé'
                : `Par ${doc.author}`;
              const isHighlighted = highlightedDocId && (doc.id.includes(highlightedDocId) || isBilan);

              return (
                <div
                  key={doc.id}
                  id={`doc-${doc.id}`}
                  className={`p-6 rounded-3xl border transition-all shadow-sm space-y-3 ${
                    isHighlighted
                      ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400 shadow-md'
                      : 'bg-emerald-50/40 border-emerald-200/80 hover:border-forest-moss'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-black uppercase text-amber-900 bg-amber-200/80 px-3 py-1 rounded-full">
                        {isBilan ? 'Bilan Financier' : doc.type === 'PV' ? 'Procès-Verbal (PV)' : 'Règlement Intérieur'}
                      </span>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-0.5 rounded-full border border-emerald-200">
                        {displaySubtitle}
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {doc.date}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-900">{displayTitle}</h3>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
                    {isBilan
                      ? `Document Officiel Bi-Signé • Archivé\n\nSynthèse financière certifiée par le Trésorier Général et le Payor.`
                      : doc.content}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="inline-flex items-center gap-1 text-emerald-800 text-[11px] font-extrabold bg-emerald-100 px-3 py-1 rounded-full">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Validé & Archivé Officiellement
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePrintArchiveDoc(doc)}
                        className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors"
                        title="Imprimer ou enregistrer au format PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>PDF / Imprimer</span>
                      </button>

                      <button
                        onClick={() => {
                          const element = document.createElement('a');
                          const file = new Blob([`${displayTitle}\n${displaySubtitle}\nDate: ${doc.date}\nAuteur: ${doc.author}\n\n${doc.content}`], {
                            type: 'text/plain',
                          });
                          element.href = URL.createObjectURL(file);
                          element.download = `${displayTitle.replace(/[\s\(\)]+/g, '_')}_EROUAMA.txt`;
                          document.body.appendChild(element);
                          element.click();
                          document.body.removeChild(element);
                        }}
                        className="text-xs font-bold text-forest-moss hover:text-emerald-800 flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-sm cursor-pointer hover:bg-emerald-50 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Télécharger TXT</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
