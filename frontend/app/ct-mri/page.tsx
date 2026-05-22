'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

const SLICES = Array.from({ length: 12 }, (_, i) => i);

export default function CTMRIPage() {
  const [activeSlice, setActiveSlice] = useState(3);
  const [window, setWindow] = useState<'lung' | 'mediastinal' | 'bone'>('lung');
  const [slice, setSlice] = useState(30);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-3 rounded-xl text-xs mb-2"
        style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', color: '#ffb347' }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span><strong>DICOM Viewer.</strong> AI lesion detection requires radiologist confirmation. This viewer is for reference only.</span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="text-sm font-semibold">DICOM Viewer — CT Chest · Patient #1038</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>Yasmine Ait Ahmed · 45F · Axial view · 80 slices</div>
          </div>
          <div className="flex items-center gap-2">
            {(['lung', 'mediastinal', 'bone'] as const).map((w) => (
              <button key={w} onClick={() => setWindow(w)}
                className="px-3 py-1.5 rounded-lg text-xs capitalize transition-all"
                style={{
                  background: window === w ? 'var(--accent2)' : 'var(--surface2)',
                  color: window === w ? 'white' : 'var(--text2)',
                  border: `1px solid ${window === w ? 'var(--accent2)' : 'var(--border2)'}`,
                }}>
                {w}
              </button>
            ))}
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'linear-gradient(135deg,var(--accent2),#005588)', color: 'white' }}>
              AI Analyze
            </button>
          </div>
        </div>

        {/* Main viewer area */}
        <div className="p-4">
          <div className="grid grid-cols-4 gap-2 mb-4">
            {SLICES.map((i) => (
              <button key={i} onClick={() => setActiveSlice(i)}
                className="aspect-square rounded-lg overflow-hidden transition-all"
                style={{
                  border: `2px solid ${activeSlice === i ? 'var(--accent)' : 'var(--border)'}`,
                  background: '#000',
                }}>
                <svg width="100%" height="100%" viewBox="0 0 100 100">
                  {/* Chest CT slice simulation */}
                  <ellipse cx="50" cy="50" rx="42" ry="46" fill="rgba(20,35,55,0.95)"/>
                  <ellipse cx="32" cy="50" rx="18" ry="28" fill="rgba(35,55,85,0.8)"/>
                  <ellipse cx="68" cy="50" rx="18" ry="28" fill="rgba(35,55,85,0.8)"/>
                  <ellipse cx="50" cy="55" rx="12" ry="16" fill="rgba(55,75,100,0.9)"/>
                  {/* Ribs */}
                  <ellipse cx="50" cy="50" rx="42" ry="46" fill="none" stroke="rgba(150,170,200,0.4)" strokeWidth="2"/>
                  {i === 3 && (
                    <ellipse cx="35" cy="65" rx="10" ry="7" fill="rgba(255,77,109,0.5)"
                      stroke="rgba(255,77,109,0.8)" strokeWidth="0.8"/>
                  )}
                  <text x="4" y="12" fill="rgba(0,212,255,0.6)" fontSize="8" fontFamily="monospace">
                    {`S${(i + 1) * 7}`}
                  </text>
                </svg>
              </button>
            ))}
          </div>

          {/* Main slice view */}
          <div className="rounded-xl overflow-hidden mb-4" style={{ background: '#000', border: '1px solid var(--border)' }}>
            <svg width="100%" height="280" viewBox="0 0 560 280">
              {/* Grid */}
              <defs>
                <pattern id="ctgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,212,255,0.04)" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="560" height="280" fill="#050a10"/>
              <rect width="560" height="280" fill="url(#ctgrid)"/>

              {/* CT chest anatomy */}
              <ellipse cx="280" cy="140" rx="200" ry="130" fill="rgba(15,30,50,0.9)" stroke="rgba(100,150,200,0.3)" strokeWidth="1.5"/>
              {/* Left lung */}
              <ellipse cx="200" cy="140" rx="80" ry="100" fill="rgba(30,50,80,0.8)"/>
              {/* Right lung */}
              <ellipse cx="360" cy="140" rx="80" ry="100" fill="rgba(30,50,80,0.8)"/>
              {/* Heart/mediastinum */}
              <ellipse cx="280" cy="150" rx="55" ry="70" fill="rgba(50,70,100,0.9)"/>
              {/* Spine */}
              <ellipse cx="280" cy="230" rx="18" ry="22" fill="rgba(180,200,220,0.6)"/>
              {/* Trachea */}
              <ellipse cx="280" cy="60" rx="10" ry="15" fill="rgba(0,0,0,0.8)" stroke="rgba(100,150,200,0.5)" strokeWidth="1"/>

              {/* AI detected lesion highlight */}
              {activeSlice === 3 && (
                <>
                  <ellipse cx="210" cy="190" rx="28" ry="20"
                    fill="rgba(255,77,109,0.2)" stroke="rgba(255,77,109,0.7)" strokeWidth="1.5" strokeDasharray="4,2"/>
                  <text x="175" y="220" fill="rgba(255,77,109,0.9)" fontSize="10" fontFamily="monospace">⚠ Opacity</text>
                  <line x1="210" y1="190" x2="175" y2="215" stroke="rgba(255,77,109,0.5)" strokeWidth="0.8"/>
                </>
              )}

              {/* Measurements overlay */}
              <text x="10" y="20" fill="rgba(0,212,255,0.7)" fontSize="10" fontFamily="monospace">CT CHEST · AXIAL</text>
              <text x="10" y="35" fill="rgba(0,212,255,0.5)" fontSize="9" fontFamily="monospace">
                {`WL:${window === 'lung' ? '-600/1500' : window === 'mediastinal' ? '40/400' : '400/1500'}`}
              </text>
              <text x="10" y="268" fill="rgba(0,212,255,0.5)" fontSize="9" fontFamily="monospace">
                {`Slice: ${slice}/80 · 5mm`}
              </text>
              <text x="440" y="268" fill="rgba(0,212,255,0.5)" fontSize="9" fontFamily="monospace">
                MediCore AI
              </text>
            </svg>
          </div>

          {/* Slice controls */}
          <div className="flex items-center gap-3">
            <button onClick={() => setSlice((s) => Math.max(1, s - 1))}
              className="p-2 rounded-lg transition-all"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)' }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input type="range" min="1" max="80" value={slice} onChange={(e) => setSlice(Number(e.target.value))}
              className="flex-1 accent-cyan-500" />
            <button onClick={() => setSlice((s) => Math.min(80, s + 1))}
              className="p-2 rounded-lg transition-all"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)' }}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xs w-20 text-right" style={{ color: 'var(--text3)', fontFamily: 'DM Mono' }}>
              {slice} / 80
            </span>
          </div>
        </div>

        {/* AI findings */}
        {activeSlice === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mx-4 mb-4 p-3 rounded-xl text-xs"
            style={{ background: 'rgba(255,179,71,0.08)', border: '1px solid rgba(255,179,71,0.25)' }}>
            <div className="font-semibold mb-1" style={{ color: '#ffb347' }}>⚠ AI Detection — Slice S21</div>
            <div style={{ color: 'var(--text2)' }}>
              Focal area of increased opacity in the left lower lobe (LLL), approximately 28mm × 20mm.
              Differential: consolidation, ground-glass opacity, early nodule. Confidence: 78%.
              Radiologist review required.
            </div>
          </motion.div>
        )}

        <div className="mx-4 mb-4 flex gap-2 p-2.5 rounded-lg text-xs"
          style={{ background: 'rgba(255,179,71,0.07)', border: '1px solid rgba(255,179,71,0.2)', color: '#ffb347' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          DICOM viewer for reference only. AI lesion detection results require radiologist confirmation before clinical use.
        </div>
      </div>
    </div>
  );
}
