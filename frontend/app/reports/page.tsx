'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, AlertTriangle, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';

type Lang = 'en' | 'fr' | 'ar';

export default function ReportsPage() {
  const [language, setLanguage] = useState<Lang>('en');
  const [reportType, setReportType] = useState('ecg');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are a senior clinical AI generating a professional hospital-grade medical report.
Write in formal ${language === 'en' ? 'English' : language === 'fr' ? 'French' : 'Arabic'}.
Return ONLY JSON: {"title":"string","reportText":"string with \\n\\n between paragraphs","keyPoints":["strings"],"priority":"routine|urgent|emergent","confidence":number}`,
          messages: [{
            role: 'user',
            content: `Generate a ${reportType.toUpperCase()} medical report. Patient: Mariam Benali, 58F, #1047. Presenting with acute chest pain and diaphoresis. ECG shows inferior STEMI pattern (94% AI confidence). Elevated Troponin I 8.4 ng/mL. SpO2 94%. Known HTN and DM2. ${notes ? `Additional notes: ${notes}` : ''}`,
          }],
        }),
      });
      const data = await response.json();
      const raw = data.content?.map((c: any) => c.text || '').join('') || '';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      setReport(parsed);
      toast.success('Report generated successfully');
    } catch {
      // Demo fallback
      setReport(DEMO_REPORT);
      toast.success('Report generated (demo)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Config panel */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-5">
          <FileText className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          Report Configuration
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)' }}>Patient</label>
            <input readOnly value="Mariam Benali · #1047 · 58F"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)' }}>Report Type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              <option value="ecg">ECG Interpretation</option>
              <option value="xray">Chest X-Ray</option>
              <option value="ct">CT / MRI</option>
              <option value="labs">Lab Results</option>
              <option value="complete">Complete Assessment</option>
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)' }}>Report Language</label>
            <div className="grid grid-cols-3 gap-2">
              {([['en', '🇬🇧 English'], ['fr', '🇫🇷 Français'], ['ar', '🇩🇿 العربية']] as [Lang, string][]).map(([l, label]) => (
                <button key={l} onClick={() => setLanguage(l)}
                  className="py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: language === l ? 'rgba(0,153,204,0.15)' : 'var(--bg3)',
                    border: `1px solid ${language === l ? 'var(--accent2)' : 'var(--border)'}`,
                    color: language === l ? 'var(--accent)' : 'var(--text3)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)' }}>Additional Clinical Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
              placeholder="Add clinical context, history, or specific concerns..."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          <button onClick={generate} disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,var(--accent2),#005588)', color: 'white' }}>
            <FileText className="w-4 h-4" />
            {loading ? 'Generating Report...' : 'Generate Clinical Report'}
          </button>
        </div>

        {/* Recent reports */}
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-xs font-semibold mb-3" style={{ color: 'var(--text2)' }}>Recent Reports</div>
          {[
            { name: 'Mariam Benali #1047', type: 'ECG', status: 'Draft',    time: '2 min ago' },
            { name: 'Omar Khelil #1052',   type: 'Labs', status: 'Signed',  time: '1h ago'    },
            { name: 'Farid Mouloud #1031', type: 'CXR',  status: 'Signed',  time: '3h ago'    },
          ].map((r) => (
            <div key={r.name} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid rgba(30,48,80,0.4)' }}>
              <div className="flex-1">
                <div className="text-xs font-medium">{r.name}</div>
                <div className="text-[10px]" style={{ color: 'var(--text3)' }}>{r.type} · {r.time}</div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: r.status === 'Signed' ? 'rgba(0,229,160,0.1)' : 'rgba(255,179,71,0.1)',
                  color: r.status === 'Signed' ? '#00e5a0' : '#ffb347',
                }}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Report output */}
      <div>
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-xl p-10 flex flex-col items-center gap-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <div className="text-sm" style={{ color: 'var(--text2)' }}>Claude AI generating clinical report...</div>
            </motion.div>
          )}

          {!loading && report && (
            <motion.div key="report" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              {/* Report header */}
              <div className="p-4 flex items-start justify-between"
                style={{ background: 'linear-gradient(135deg,rgba(0,150,200,0.15),rgba(100,50,200,0.08))', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div className="text-xs font-bold tracking-wide mb-0.5" style={{ color: 'var(--accent)' }}>
                    MEDICORE CLINICAL AI REPORT
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text3)' }}>
                    {new Date().toLocaleString()} · DRAFT — Awaiting Physician Signature
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                    Language: {language === 'en' ? 'English' : language === 'fr' ? 'French' : 'Arabic'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{
                      background: report.priority === 'emergent' ? 'rgba(255,77,109,0.15)' : report.priority === 'urgent' ? 'rgba(255,179,71,0.15)' : 'rgba(0,229,160,0.15)',
                      color: report.priority === 'emergent' ? '#ff4d6d' : report.priority === 'urgent' ? '#ffb347' : '#00e5a0',
                      border: `1px solid ${report.priority === 'emergent' ? 'rgba(255,77,109,0.3)' : report.priority === 'urgent' ? 'rgba(255,179,71,0.3)' : 'rgba(0,229,160,0.3)'}`,
                    }}>
                    {(report.priority || 'urgent').toUpperCase()}
                  </span>
                  <div className="text-xl font-black" style={{ fontFamily: 'Syne', color: '#00e5a0' }}>
                    {report.confidence || 91}%
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Report title */}
                {report.title && (
                  <div className="text-sm font-bold" style={{ fontFamily: 'Syne', color: 'var(--text)' }}>{report.title}</div>
                )}

                {/* Report body */}
                <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="space-y-3">
                  {(report.reportText || '').split('\n\n').filter(Boolean).map((para: string, i: number) => (
                    <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>{para}</p>
                  ))}
                </div>

                {/* Key points */}
                {report.keyPoints?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Key Points</span>
                      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    </div>
                    {report.keyPoints.map((k: string, i: number) => (
                      <div key={i} className="p-2 rounded border-l-2 mb-1.5 text-xs"
                        style={{ borderColor: '#00e5a0', background: 'rgba(0,229,160,0.05)', color: 'var(--text2)' }}>
                        • {k}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'linear-gradient(135deg,var(--accent2),#005588)', color: 'white' }}>
                    <Download className="w-3.5 h-3.5" /> Export PDF
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                  <button className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
                    Share Securely
                  </button>
                </div>

                {/* Disclaimer */}
                <div className="flex gap-2 p-2.5 rounded-lg text-xs"
                  style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', color: '#ffb347' }}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>AI-GENERATED DRAFT.</strong> This report must be reviewed, edited, and countersigned by a licensed physician before clinical use. Not valid as a standalone medical document.
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {!loading && !report && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-xl flex items-center justify-center min-h-80"
              style={{ background: 'rgba(15,26,46,0.4)', border: '1px dashed var(--border)' }}>
              <div className="text-center" style={{ color: 'var(--text3)' }}>
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Configure and generate a clinical report</p>
                <p className="text-xs mt-1">Supports English, French, and Arabic</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const DEMO_REPORT = {
  title: 'ACUTE CARDIAC EVENT — CLINICAL SUMMARY REPORT',
  reportText: `PATIENT: Mariam Benali | DOB: 1966 | SEX: Female | MRN: #1047\nDATE: ${new Date().toLocaleDateString()} | DEPARTMENT: Cardiology | STATUS: EMERGENT\n\nCLINICAL HISTORY:\nThe patient is a 58-year-old female with known hypertension and type 2 diabetes mellitus presenting with acute onset chest pain and diaphoresis. Vital signs on admission reveal tachycardia (112 bpm), hypertension (158/96 mmHg), tachypnea (22/min), and hypoxemia (SpO₂ 94%).\n\nECG FINDINGS (AI-Assisted, Confidence: 94.2%):\nThe 12-lead ECG demonstrates ST elevation of 2mm in leads II, III, and aVF with reciprocal ST depression in leads I and aVL. Sinus tachycardia at 112 bpm. Borderline QTc prolongation at 440ms. The pattern is consistent with an acute inferior ST-elevation myocardial infarction (STEMI).\n\nLABORATORY FINDINGS:\nMarkedly elevated Troponin I at 8.4 ng/mL (reference <0.04 ng/mL), representing a 210-fold elevation above the upper limit of normal. Leukocytosis at 14.2 ×10³/µL and elevated CRP at 48.2 mg/L, consistent with an acute inflammatory response. Mild normocytic anemia (Hgb 11.8 g/dL).\n\nIMPRESSION:\nThe clinical, electrocardiographic, and laboratory findings are consistent with an acute inferior myocardial infarction. Emergent reperfusion therapy is indicated.`,
  keyPoints: [
    'Inferior STEMI pattern on ECG (ST elevation II, III, aVF) — AI confidence 94.2%',
    'Troponin I critically elevated at 8.4 ng/mL (210× ULN)',
    'Emergent cardiology consultation and STEMI protocol activation indicated',
    'Obtain right-sided leads to exclude RV infarction before nitroglycerin',
  ],
  priority: 'emergent',
  confidence: 94,
};
