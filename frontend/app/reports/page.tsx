'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, AlertTriangle, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { reportsAPI } from '@/lib/api';

type Lang = 'en' | 'fr' | 'ar';

export default function ReportsPage() {
  const [language, setLanguage] = useState<Lang>('en');
  const [studyId, setStudyId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const generate = async () => {
    if (!studyId.trim()) {
      toast.error('Enter a real study ID from an ECG, X-ray, or lab result');
      return;
    }
    setLoading(true);
    setReport(null);
    try {
      const generated = await reportsAPI.generate({
        study_id: studyId.trim(),
        language,
        clinical_notes: notes,
      });
      setReport(generated);
      toast.success('Draft report generated');
    } catch (err: any) {
      toast.error(err.message || 'Unable to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-5">
          <FileText className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          Report Configuration
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)' }}>Study ID</label>
            <input value={studyId} onChange={(e) => setStudyId(e.target.value)}
              placeholder="Paste a completed study UUID"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)' }}>Report Language</label>
            <div className="grid grid-cols-3 gap-2">
              {([['en', 'English'], ['fr', 'Francais'], ['ar', 'Arabic']] as [Lang, string][]).map(([lang, label]) => (
                <button key={lang} onClick={() => setLanguage(lang)}
                  className="py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: language === lang ? 'rgba(0,153,204,0.15)' : 'var(--bg3)',
                    border: `1px solid ${language === lang ? 'var(--accent2)' : 'var(--border)'}`,
                    color: language === lang ? 'var(--accent)' : 'var(--text3)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)' }}>Additional Clinical Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5}
              placeholder="Clinical context, reason for exam, symptoms, relevant history..."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          <button onClick={generate} disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,var(--accent2),#005588)', color: 'white' }}>
            <FileText className="w-4 h-4" />
            {loading ? 'Generating Draft...' : 'Generate Draft From Study'}
          </button>
        </div>
      </div>

      <div>
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-xl p-10 flex flex-col items-center gap-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <div className="text-sm" style={{ color: 'var(--text2)' }}>Generating clinical draft from backend result...</div>
            </motion.div>
          )}

          {!loading && report && (
            <motion.div key="report" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <div className="p-4 flex items-start justify-between"
                style={{ background: 'linear-gradient(135deg,rgba(0,150,200,0.15),rgba(100,50,200,0.08))', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div className="text-xs font-bold tracking-wide mb-0.5" style={{ color: 'var(--accent)' }}>
                    MEDICORE CLINICAL AI REPORT
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text3)' }}>
                    {new Date().toLocaleString()} · DRAFT · Awaiting physician signature
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: 'rgba(255,179,71,0.15)', color: '#ffb347', border: '1px solid rgba(255,179,71,0.3)' }}>
                  {report.status || 'draft'}
                </span>
              </div>

              <div className="p-4 space-y-4">
                <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="space-y-3">
                  {(report.report_text || '').split('\n\n').filter(Boolean).map((paragraph: string, index: number) => (
                    <p key={index} className="text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>{paragraph}</p>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'linear-gradient(135deg,var(--accent2),#005588)', color: 'white' }}>
                    <Download className="w-3.5 h-3.5" /> Export PDF
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text2)' }}>
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                </div>

                <div className="flex gap-2 p-2.5 rounded-lg text-xs"
                  style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', color: '#ffb347' }}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{report.disclaimer || 'AI-generated draft. Must be reviewed and signed by a licensed physician.'}</span>
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
                <p className="text-sm">Generate reports from real completed studies</p>
                <p className="text-xs mt-1">No hard-coded patient reports are used</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
