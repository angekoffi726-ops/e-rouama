import React from 'react';
import { useApp } from '../../context/AppContext';
import { Rocket, TrendingUp, Users, Printer } from 'lucide-react';
import { AgrProject } from '../../types';

export const ProjetsTab: React.FC = () => {
  const { projects } = useApp();

  const publishedProjects = projects.filter(p => p.status === 'PUBLISHED');

  const handlePrintProjectPDF = (proj: AgrProject) => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Veuillez autoriser les popups pour imprimer la fiche du projet.');
      return;
    }

    const teamList =
      proj.pilotTeam && proj.pilotTeam.length > 0
        ? proj.pilotTeam.map(m => `<li style="margin-bottom:6px;">👤 <strong>${m}</strong></li>`).join('')
        : '<li><em>Aucun membre désigné</em></li>';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>PROJET AGR - ${proj.title}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; background: #fff; }
          .header { text-align: center; border-bottom: 3px double #d97706; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { font-size: 18pt; color: #065f46; margin: 0 0 5px 0; text-transform: uppercase; font-weight: 800; }
          .header h2 { font-size: 12pt; color: #d97706; margin: 0 0 5px 0; font-weight: 700; }
          .header p { font-size: 9pt; color: #64748b; margin: 0; }
          .title-box { background: #fffbe0; border: 1.5px solid #f59e0b; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 20px; }
          .title-box h3 { margin: 0; font-size: 15pt; color: #92400e; font-weight: 800; text-transform: uppercase; }
          .status-badge { display: inline-block; background: #dcfce7; color: #166534; font-weight: bold; font-size: 9pt; padding: 4px 12px; border-radius: 12px; border: 1px solid #86efac; margin-top: 6px; }
          .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 25px; background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #d97706; }
          .meta-item { font-size: 10pt; }
          .meta-label { font-weight: bold; color: #475569; text-transform: uppercase; font-size: 8pt; display: block; }
          .meta-value { font-weight: 700; color: #0f172a; }
          .section-title { font-size: 11pt; font-weight: 800; color: #065f46; text-transform: uppercase; border-bottom: 1.5px solid #065f46; padding-bottom: 4px; margin-top: 20px; margin-bottom: 12px; }
          .team-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .team-box ul { margin: 5px 0 0 0; padding-left: 20px; color: #166534; font-size: 10pt; list-style-type: none; }
          .content-body { font-size: 10pt; color: #334155; white-space: pre-wrap; background: #fafafa; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; min-height: 150px; }
          .signatures { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 45%; }
          .sig-title { font-size: 9pt; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 45px; }
          .sig-line { border-top: 1px solid #94a3b8; margin-top: 10px; font-size: 8pt; color: #64748b; }
          .footer { margin-top: 35px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/LOGOPRO.png" alt="Logo E-ROUAMA" style="height:55px; margin-bottom:8px; object-fit:contain;" />
          <h1>ASSOCIATION ÉLÈVES & ÉTUDIANTS ROUAMA (E-ROUAMA)</h1>
          <h2>COMMISSION PROJETS (AGR) & DIRECTION ADMINISTRATIVE</h2>
          <p>Dossier Officiel de Montage de Projet Générateur de Revenus</p>
        </div>

        <div class="title-box">
          <h3>${proj.title}</h3>
          <span class="status-badge">PROJET VALIDÉ & ACTIF</span>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">🏷️ Catégorie du Projet</span>
            <span class="meta-value">${proj.category || 'Non spécifiée'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">💰 Coût Estimé (Budget)</span>
            <span class="meta-value">${proj.estimatedCost.toLocaleString('fr-FR')} F CFA</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">📅 Date de Soumission</span>
            <span class="meta-value">${proj.date || 'Non spécifiée'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">📜 Référence Officielle</span>
            <span class="meta-value">${proj.id}</span>
          </div>
        </div>

        <div class="section-title">👥 ÉQUIPE PILOTE (RESPONSABLES DU SUIVI)</div>
        <div class="team-box">
          <ul>${teamList}</ul>
        </div>

        <div class="section-title">📝 DESCRIPTION & MODÈLE ÉCONOMIQUE DE RENTABILITÉ</div>
        <div class="content-body">${proj.description}</div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-title">La Commission Projets</div>
            <div class="sig-line">Signature & Date</div>
          </div>
          <div class="sig-box">
            <div class="sig-title">Le PAYOR / Direction</div>
            <div class="sig-line">Visa de Validation</div>
          </div>
        </div>

        <div class="footer">
          Document d'ingénierie projet extrait de la plateforme E-ROUAMA le ${new Date().toLocaleString('fr-FR')}
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

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-white rounded-[3rem] p-6 sm:p-8 shadow-sm border border-[#355E3B]/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-100 pb-4">
          <div>
            <h2 className="text-2xl font-black text-[#355E3B] flex items-center gap-2">
              <Rocket className="w-6 h-6 text-[#E67E22]" />
              <span>Projets d'Investissement Collectifs (AGR)</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Fiches des Activités Génératrices de Revenus (AGR) validées par le PAYOR et suivies par l'Équipe Pilote.
            </p>
          </div>
        </div>

        {publishedProjects.length === 0 ? (
          <div className="text-center py-12 bg-emerald-50/30 rounded-3xl border border-dashed border-emerald-200 text-slate-500 text-sm">
            Aucun projet AGR publié pour le moment. (Les projets soumis par la Commission Projets apparaîtront ici après validation).
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {publishedProjects.map(proj => (
              <div
                key={proj.id}
                className="bg-emerald-50/40 rounded-3xl p-6 border-2 border-emerald-200/80 shadow-sm flex flex-col justify-between space-y-4 hover:border-forest-moss transition-all"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase text-amber-900 bg-amber-200/80 px-3 py-1 rounded-full">
                      {proj.category}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{proj.date}</span>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">{proj.title}</h3>
                    <p className="text-xs text-slate-700 leading-relaxed">{proj.description}</p>
                  </div>

                  {/* 👥 Équipe Pilote Block */}
                  <div className="bg-white p-3.5 rounded-2xl border border-amber-200 space-y-1.5">
                    <span className="text-[10px] uppercase font-black text-amber-900 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-amber-600" />
                      <span>Équipe Pilote (Responsables du Suivi)</span>
                    </span>
                    {proj.pilotTeam && proj.pilotTeam.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {proj.pilotTeam.map((m, idx) => (
                          <span
                            key={idx}
                            className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-xl text-xs font-bold"
                          >
                            👤 {m}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Aucun membre désigné</p>
                    )}
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-slate-500 block">
                      Coût Estimé
                    </span>
                    <span className="text-base font-black text-forest-moss">
                      {proj.estimatedCost.toLocaleString('fr-FR')} F CFA
                    </span>
                  </div>
                </div>

                {/* Return Tracker & Print PDF */}
                <div className="pt-3 border-t border-emerald-200/60 flex items-center justify-between text-xs font-bold text-slate-700 gap-2">
                  <div className="flex items-center gap-1 text-emerald-800">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>Retour :</span>
                    <span className="text-sm font-black text-forest-moss ml-1">
                      {proj.currentReturn.toLocaleString('fr-FR')} F CFA
                    </span>
                  </div>

                  <button
                    onClick={() => handlePrintProjectPDF(proj)}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs transition-all active:scale-95"
                    title="Imprimer ou télécharger la fiche PDF"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-700" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
