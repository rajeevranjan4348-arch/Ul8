import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Mic, Send, Code, Search, FileText, Zap, Brain, Eye, Upload, X, Loader, Sparkles, Star, Trash2, Copy, Volume2, VolumeX, Download, Plus, Pin, PinOff, Edit2, RefreshCw, Palette, BookOpen, ChevronRight, Check, CheckCheck, User, Bot, MoreHorizontal, Command, Maximize2, Minimize2, BarChart2, Activity, Quote, Play, Hash, Square, MessageSquare, Briefcase } from 'lucide-react';
import { getAiInstance, transcribeAudio, generateSpeech } from '../services/gemini';
import { speakText, stopSpeech } from '../utils/speech';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';
import { WorkspaceWidget } from '../components/WorkspaceWidget';
import { sounds, triggerHaptic } from '../components/PremiumEffects';
import { useAutoSaveDraft } from '../hooks/useAutoSaveDraft';

// ─── THEMES ──────────────────────────────────────────────
const T = {
  void:    { name:'Void',   e:'🌌', bg:'radial-gradient(ellipse at 20% 10%,#1e1b4b,#0f172a 50%,#020617)', a1:'#00d9ff', a2:'#a855f7', a3:'#ec4899', sf:'rgba(255,255,255,0.06)', bd:'rgba(255,255,255,0.12)', orbs:['rgba(0,217,255,0.2)','rgba(168,85,247,0.18)','rgba(236,72,153,0.15)','rgba(0,217,255,0.1)','rgba(16,185,129,0.12)','rgba(245,158,11,0.1)'] },
  ocean:   { name:'Ocean',  e:'🌊', bg:'radial-gradient(ellipse at 20% 10%,#0c2340,#071525 50%,#020a10)', a1:'#38bdf8', a2:'#0ea5e9', a3:'#06b6d4', sf:'rgba(14,165,233,0.08)', bd:'rgba(56,189,248,0.2)',  orbs:['rgba(56,189,248,0.22)','rgba(6,182,212,0.18)','rgba(14,165,233,0.15)','rgba(99,102,241,0.12)','rgba(34,211,238,0.15)','rgba(56,189,248,0.1)'] },
  forest:  { name:'Forest', e:'🌿', bg:'radial-gradient(ellipse at 20% 10%,#0f2318,#071410 50%,#020a06)', a1:'#34d399', a2:'#10b981', a3:'#6ee7b7', sf:'rgba(16,185,129,0.07)', bd:'rgba(52,211,153,0.18)', orbs:['rgba(52,211,153,0.2)','rgba(16,185,129,0.15)','rgba(110,231,183,0.12)','rgba(167,243,208,0.1)','rgba(34,197,94,0.15)','rgba(74,222,128,0.1)'] },
  crimson: { name:'Crimson',e:'🔴', bg:'radial-gradient(ellipse at 20% 10%,#2d0a0a,#1a0505 50%,#0a0202)', a1:'#f87171', a2:'#ef4444', a3:'#fca5a5', sf:'rgba(239,68,68,0.07)',   bd:'rgba(248,113,113,0.2)',  orbs:['rgba(248,113,113,0.22)','rgba(239,68,68,0.15)','rgba(252,165,165,0.12)','rgba(251,146,60,0.12)','rgba(244,114,182,0.15)','rgba(248,113,113,0.1)'] },
  aurora:  { name:'Aurora', e:'🌌', bg:'radial-gradient(ellipse at 20% 10%,#0a1628,#050d1a 50%,#020609)', a1:'#a78bfa', a2:'#818cf8', a3:'#34d399', sf:'rgba(167,139,250,0.07)', bd:'rgba(167,139,250,0.2)', orbs:['rgba(167,139,250,0.22)','rgba(129,140,248,0.18)','rgba(52,211,153,0.15)','rgba(56,189,248,0.12)','rgba(244,114,182,0.15)','rgba(251,191,36,0.1)'] },
};

const MODES = [
  { id:'chat',   icon:Brain,    label:'Chat',   color:'#00d9ff', desc:'Conversation',   sys:'You are Rishi, a highly sophisticated AI assistant. Be intelligent, witty, and precise.' },
  { id:'vision', icon:Eye,      label:'Vision', color:'#a855f7', desc:'Image analysis',  sys:'You are Rishi in Vision mode. Provide expert analysis: composition, objects, text, colours.' },
  { id:'code',   icon:Code,     label:'Code',   color:'#10b981', desc:'Engineering',    sys:'You are Rishi in Code mode. Give expert, production-ready code with labelled code blocks.' },
  { id:'search', icon:Search,   label:'Search', color:'#f59e0b', desc:'Web search',     sys:'You are Rishi in Search mode. Use web_search for current information. Always cite sources.' },
  { id:'files',  icon:FileText, label:'Files',  color:'#ec4899', desc:'Documents',      sys:'You are Rishi in Files mode. Analyse documents, extract key points, provide structured summaries.' },
];

const PROMPTS = {
  Writing:  [{l:'Blog intro',p:'Write a compelling blog post introduction about: '},{l:'Email draft',p:'Write a professional email requesting: '},{l:'Story opener',p:'Write a short creative story set in: '},{l:'Tweet thread',p:'Write an engaging Twitter thread about: '}],
  Code:     [{l:'Code review',p:'Review this code for bugs and improvements:\n```\n\n```'},{l:'Unit tests',p:'Write unit tests for:\n```\n\n```'},{l:'Explain code',p:'Explain step by step:\n```\n\n```'},{l:'Optimise',p:'Optimise for performance:\n```\n\n```'}],
  Analysis: [{l:'SWOT',p:'Perform a SWOT analysis of: '},{l:'Compare',p:'Compare with a recommendation:\n1.\n2.\n3.'},{l:'Root cause',p:'Root cause analysis of: '},{l:'Risk assess',p:'Identify risks for: '}],
  Learning: [{l:'Explain it',p:'Explain at beginner then expert level: '},{l:'Study guide',p:'Create a study guide for: '},{l:'Quiz me',p:'Create 10 quiz questions about: '},{l:'Analogy',p:'Explain using 3 analogies: '}],
};

const SUGGESTS = {
  chat:   ['Tell me more','Give an example','Simplify that','Pros and cons?'],
  vision: ['More detail','Identify all text','Rate composition','Describe colours'],
  code:   ['Add error handling','Write tests','Explain line by line','Optimise this'],
  search: ['More sources','When did this happen?','Latest updates?','Summarise key facts'],
  files:  ['Extract action items','List key people','What are the risks?','3-bullet summary'],
};

const EMOJIS = ['👍','❤️','😂','🤯','🔥','💯','✨','🎯','🤌','👀'];
const est = (t: string) => Math.ceil((t||'').length/4);
const costStr = (n: number) => `$${(n/1000*0.003).toFixed(4)}`;

// ─── Neural Grid Canvas ────────────────────────────────
function NeuralGrid({ active, a1 }: { active: boolean, a1: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);
  
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    let W = c.offsetWidth;
    let H = c.offsetHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.scale(dpr, dpr);
    const t0 = Date.now();
    
    interface GridDot {
      baseX: number;
      baseY: number;
      x: number;
      y: number;
      ph: number;
    }
    
    let grid: GridDot[][] = [];
    const cellSize = 38;
    
    const initGrid = () => {
      grid = [];
      const cols = Math.ceil(W / cellSize) + 1;
      const rows = Math.ceil(H / cellSize) + 1;
      for (let x = 0; x < cols; x++) {
        grid[x] = [];
        for (let y = 0; y < rows; y++) {
          grid[x][y] = {
            baseX: x * cellSize,
            baseY: y * cellSize,
            x: x * cellSize,
            y: y * cellSize,
            ph: Math.random() * Math.PI * 2
          };
        }
      }
    };
    initGrid();

    const hexToRgb = (hex: string) => { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '0,217,255'; };
    const rgb = hexToRgb(a1);
    
    let mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000, radius: 150, active: false };
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = c.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
      mouse.active = true;
    };
    
    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    
    const draw = () => {
      const t = (Date.now() - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      
      // Interpolate mouse smoothly
      if (mouse.active) {
        mouse.x += (mouse.targetX - mouse.x) * 0.12;
        mouse.y += (mouse.targetY - mouse.y) * 0.12;
      } else {
        mouse.x += (-1000 - mouse.x) * 0.12;
        mouse.y += (-1000 - mouse.y) * 0.12;
      }

      const cols = grid.length;
      const rows = cols > 0 ? grid[0].length : 0;

      // Update positions
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          const d = grid[x][y];
          const waveX = Math.sin(t * 0.6 + d.ph) * 3.5;
          const waveY = Math.cos(t * 0.5 + d.ph) * 3.5;
          
          const dx = d.baseX - mouse.x;
          const dy = d.baseY - mouse.y;
          const dist = Math.hypot(dx, dy);
          let dispX = 0;
          let dispY = 0;
          if (dist < mouse.radius && mouse.active) {
            const force = (1 - dist / mouse.radius) * 16;
            const angle = Math.atan2(dy, dx);
            dispX = Math.cos(angle) * force;
            dispY = Math.sin(angle) * force;
          }
          
          d.x = d.baseX + waveX + dispX;
          d.y = d.baseY + waveY + dispY;
        }
      }

      // Draw grid connections (O(N) operation instead of O(N^2))
      ctx.lineWidth = 0.8;
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          const d = grid[x][y];
          
          if (x < cols - 1) {
            const r = grid[x + 1][y];
            const mDist = Math.hypot(d.x - mouse.x, d.y - mouse.y);
            const mouseFactor = (mouse.active && mDist < mouse.radius) ? (1 - mDist / mouse.radius) * 1.5 : 0;
            const alpha = (0.06 + mouseFactor * 0.16) * (Math.sin(t * 0.5 + d.ph) * 0.3 + 0.7);
            
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(r.x, r.y);
            ctx.strokeStyle = `rgba(${rgb},${alpha})`;
            ctx.stroke();
          }
          
          if (y < rows - 1) {
            const b = grid[x][y + 1];
            const mDist = Math.hypot(d.x - mouse.x, d.y - mouse.y);
            const mouseFactor = (mouse.active && mDist < mouse.radius) ? (1 - mDist / mouse.radius) * 1.5 : 0;
            const alpha = (0.06 + mouseFactor * 0.16) * (Math.sin(t * 0.5 + d.ph) * 0.3 + 0.7);
            
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${rgb},${alpha})`;
            ctx.stroke();
          }
        }
      }

      // Draw dots
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          const d = grid[x][y];
          const wave = (Math.sin(t * 0.6 + d.ph) * 0.5 + 0.5) * (active ? (Math.sin(t * 4 + d.ph) * 0.3 + 0.7) : 0.5);
          const mDist = Math.hypot(d.x - mouse.x, d.y - mouse.y);
          const size = (mouse.active && mDist < mouse.radius) ? 1.5 + (1 - mDist / mouse.radius) * 1.5 : 1.3;
          const extraAlpha = (mouse.active && mDist < mouse.radius) ? (1 - mDist / mouse.radius) * 0.4 : 0;
          
          ctx.beginPath();
          ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb},${wave * 0.4 + extraAlpha})`;
          ctx.fill();
        }
      }

      raf.current = requestAnimationFrame(draw);
    };
    draw();

    const resizeObserver = new ResizeObserver(() => {
      if (!c) return;
      const currentDpr = window.devicePixelRatio || 1;
      W = c.offsetWidth;
      H = c.offsetHeight;
      c.width = W * currentDpr;
      c.height = H * currentDpr;
      ctx.scale(currentDpr, currentDpr);
      initGrid();
    });
    resizeObserver.observe(c);

    return () => { 
      if (raf.current) cancelAnimationFrame(raf.current); 
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      resizeObserver.disconnect();
    };
  }, [active, a1]);
  
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />;
}

// ─── Scan Line ─────────────────────────────────────────
function ScanLine({ color }: { color: string }) {
  return <div style={{ position:'absolute', top:0, left:0, right:0, height:'1.5px', background:`linear-gradient(90deg,transparent,${color},transparent)`, animation:'scan 1.2s linear infinite', pointerEvents:'none' }}/>;
}

// ─── Status Bars ───────────────────────────────────────
function StatusBars({ status, color }: { status: 'idle'|'thinking'|'speaking'|'listening', color: string }) {
  const labels = { idle:'Ready', thinking:'Processing…', speaking:'Speaking', listening:'Listening' };
  const cols = { idle:'rgba(255,255,255,0.3)', thinking:color, speaking:'#34d399', listening:'#ef4444' };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
      <div style={{ display:'flex', gap:'2.5px', alignItems:'center', height:'12px' }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{ width:'2.5px', borderRadius:'2px', background:cols[status],
            height: status==='idle' ? '3px' : status==='thinking' ? `${5+i*2}px` : `${4+Math.abs(Math.sin(i))*8+4}px`,
            animation: status!=='idle' ? `statusBar 0.8s ease-in-out ${i*0.1}s infinite` : 'none',
            transition:'height 0.3s ease, background 0.4s ease' }} />
        ))}
      </div>
      <span style={{ fontSize:'9px', fontFamily:'monospace', color:cols[status], letterSpacing:'0.08em', fontWeight:600, transition:'color 0.4s' }}>{labels[status]}</span>
    </div>
  );
}

// ─── Markdown renderer ─────────────────────────────────
function MD({ text, accent }: { text: string, accent: string }) {
  const [cc, setCc] = useState<string | null>(null);
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let isCancelled = false;
    let index = displayedText.length;
    
    if (text.length < displayedText.length) {
      setDisplayedText(text);
      return;
    }

    const typeNextCharacter = () => {
      if (isCancelled) return;

      if (index < text.length) {
        const remainingLength = text.length - index;
        const step = remainingLength > 50 ? 5 : remainingLength > 20 ? 3 : 1;
        
        index += step;
        setDisplayedText(text.slice(0, index));
        
        setTimeout(typeNextCharacter, 10);
      }
    };

    typeNextCharacter();

    return () => {
      isCancelled = true;
    };
  }, [text]);

  const lines = displayedText.split('\n');
  const parts = []; let inCode=false, lang='', codeLines: string[]=[], i=0;
  while (i < lines.length) {
    const l = lines[i];
    if (!inCode && l.startsWith('```')) { inCode=true; lang=l.slice(3).trim(); codeLines=[]; i++; continue; }
    if (inCode && l.startsWith('```')) {
      const cs = codeLines.join('\n');
      parts.push(
        <div key={`c${i}`} style={{ margin:'10px 0', borderRadius:'12px', overflow:'hidden', background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ padding:'6px 14px', background:'rgba(255,255,255,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.4)', fontFamily:'monospace', letterSpacing:'0.06em' }}>{lang||'code'}</span>
            <button onClick={()=>{navigator.clipboard?.writeText(cs);setCc(`c${i}`);setTimeout(()=>setCc(null),1400);}} style={{ background:'none', border:'none', color:cc===`c${i}`?'#34d399':'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'11px', padding:'2px 7px', borderRadius:'4px', fontFamily:'inherit' }}>{cc===`c${i}`?'✓ copied':'copy'}</button>
          </div>
          <pre style={{ padding:'12px 14px', margin:0, overflowX:'auto', fontSize:'12.5px', lineHeight:'1.65', fontFamily:"'JetBrains Mono','Fira Code',monospace", color:'#e2e8f0', whiteSpace:'pre' }}>{cs}</pre>
        </div>
      );
      inCode=false; codeLines=[]; i++; continue;
    }
    if (inCode) { codeLines.push(l); i++; continue; }
    const fmt = l
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;font-weight:700">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em style="color:rgba(255,255,255,0.8)">$1</em>')
      .replace(/`([^`]+)`/g, `<code style="background:rgba(0,0,0,0.45);padding:2px 6px;border-radius:5px;font-family:monospace;font-size:0.85em;color:${accent};border:1px solid rgba(255,255,255,0.09)">$1</code>`)
      .replace(/^### (.+)/, `<span style="font-size:0.93rem;font-weight:700;color:${accent}">$1</span>`)
      .replace(/^## (.+)/,  `<span style="font-size:1.05rem;font-weight:800;color:rgba(255,255,255,0.95)">$1</span>`)
      .replace(/^# (.+)/,   `<span style="font-size:1.15rem;font-weight:900;color:#fff">$1</span>`)
      .replace(/^[-*] (.+)/, `<span style="color:${accent};margin-right:5px">▸</span>$1`)
      .replace(/^> (.+)/, `<span style="border-left:2.5px solid ${accent};padding-left:10px;color:rgba(255,255,255,0.65);display:block">$1</span>`)
      .replace(/^(\d+)\. (.+)/, `<span style="color:${accent};margin-right:5px;font-weight:700;font-size:0.82em">$1.</span>$2`);
    if (!l.trim()) parts.push(<div key={i} style={{ height:'5px' }} />);
    else parts.push(<div key={i} style={{ lineHeight:'1.72', marginBottom:'1px' }} dangerouslySetInnerHTML={{ __html: fmt }} />);
    i++;
  }
  return <>{parts}</>;
}

// ─── Code Playground ───────────────────────────────────
function Playground({ code, accent }: { code: string, accent: string }) {
  const [open, setOpen] = useState(false);
  const isHTML = /(<html|<div|<script|<style|<!DOCTYPE)/i.test(code);
  if (!isHTML) return null;
  const src = `<!DOCTYPE html><html><head><style>*{box-sizing:border-box}body{background:#0d0d0d;color:#e2e8f0;font-family:system-ui,sans-serif;padding:14px;margin:0;font-size:14px}</style></head><body>${code}</body></html>`;
  return (
    <div style={{ marginTop:'8px' }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'5px 11px', borderRadius:'8px', background:`${accent}18`, border:`1px solid ${accent}44`, color:accent, fontSize:'11.5px', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
        <Play size={11} />{open ? 'Hide Preview' : '▶ Run Preview'}
      </button>
      {open && (
        <div style={{ marginTop:'8px', borderRadius:'12px', overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)', animation:'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div style={{ padding:'6px 12px', background:'rgba(255,255,255,0.05)', display:'flex', gap:'6px', alignItems:'center' }}>
            {['#ef4444','#f59e0b','#34d399'].map(c=><div key={c} style={{ width:'8px', height:'8px', borderRadius:'50%', background:c }}/>)}
            <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.35)', marginLeft:'4px', fontFamily:'monospace' }}>preview</span>
          </div>
          <iframe srcDoc={src} sandbox="allow-scripts" style={{ width:'100%', height:'200px', border:'none', background:'#0d0d0d' }} />
        </div>
      )}
    </div>
  );
}

// ─── Stats Panel ───────────────────────────────────────
function StatsPanel({ messages, tokenTotal, accent, onClose }: any) {
  const words = messages.reduce((a: number,m: any)=>a+(m.content||'').split(/\s+/).length,0);
  const ai = messages.filter((m: any)=>m.role==='assistant').length;
  const user = messages.filter((m: any)=>m.role==='user').length;
  const modeStats = MODES.map(m=>({ l:m.label, c:m.color, n:messages.filter((x: any)=>x.mode===m.id).length })).filter(x=>x.n>0);
  const max = Math.max(...modeStats.map(x=>x.n),1);
  return (
    <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:'calc(100% + 6px)', right:0, width:'255px', zIndex:400, animation:'popIn 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <div style={{ background:'rgba(6,10,24,0.97)', backdropFilter:'blur(28px)', WebkitBackdropFilter:'blur(28px)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:'18px', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ padding:'12px 16px 9px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'12px', fontWeight:700, color:'rgba(255,255,255,0.8)' }}>Session Stats</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'16px', lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:'12px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
          {[['💬',user,'Messages'],['🤖',ai,'Responses'],['📝',words.toLocaleString(),'Words'],['⚡',tokenTotal.toLocaleString(),'Tokens']].map(([e,v,l])=>(
            <div key={l as string} style={{ background:'rgba(255,255,255,0.04)', borderRadius:'10px', padding:'10px', textAlign:'center' }}>
              <div style={{ fontSize:'18px', marginBottom:'3px' }}>{e}</div>
              <div style={{ fontSize:'15px', fontWeight:800, color:'#fff', fontFamily:'monospace' }}>{v}</div>
              <div style={{ fontSize:'9px', color:'rgba(255,255,255,0.3)', letterSpacing:'0.05em', textTransform:'uppercase', marginTop:'1px' }}>{l}</div>
            </div>
          ))}
        </div>
        {modeStats.length > 0 && (
          <div style={{ padding:'0 16px 12px' }}>
            <div style={{ fontSize:'9px', color:'rgba(255,255,255,0.28)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'7px' }}>By Mode</div>
            {modeStats.map(m=>(
              <div key={m.l} style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'5px' }}>
                <span style={{ fontSize:'9.5px', color:'rgba(255,255,255,0.45)', width:'36px', flexShrink:0 }}>{m.l}</span>
                <div style={{ flex:1, height:'5px', borderRadius:'3px', background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:'3px', background:m.c, width:`${(m.n/max)*100}%`, transition:'width 0.6s ease' }}/>
                </div>
                <span style={{ fontSize:'10px', color:m.c, fontFamily:'monospace', width:'14px', textAlign:'right' }}>{m.n}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding:'9px 16px', borderTop:'1px solid rgba(255,255,255,0.06)', fontSize:'10px', color:'rgba(255,255,255,0.28)', fontFamily:'monospace', textAlign:'center' }}>{costStr(tokenTotal)} estimated</div>
      </div>
    </div>
  );
}

// ─── Command Palette ───────────────────────────────────
function CmdPalette({ theme, onAction, onClose, sessions, setSession, setMode }: any) {
  const [q, setQ] = useState('');
  const inp = useRef<HTMLInputElement>(null);
  useEffect(()=>{ inp.current?.focus(); },[]);
  const cmds = [
    ...MODES.map(m=>({ icon:'⚡', label:`Switch to ${m.label} mode`, fn:()=>{ setMode(m.id); onClose(); } })),
    ...sessions.map((s: any)=>({ icon:'💬', label:`Open: ${s.name}`, fn:()=>{ setSession(s.id); onClose(); } })),
    { icon:'📥', label:'Export Markdown',  fn:()=>{ onAction('md'); onClose(); } },
    { icon:'📊', label:'Export JSON',      fn:()=>{ onAction('json'); onClose(); } },
    { icon:'⭐', label:'View starred',     fn:()=>{ onAction('starred'); onClose(); } },
    { icon:'🧹', label:'Clear session',    fn:()=>{ onAction('clear'); onClose(); } },
    ...Object.values(PROMPTS).flat().map(p=>({ icon:'📝', label:p.l, fn:()=>{ onAction('prompt',p.p); onClose(); } })),
  ];
  const list = q ? cmds.filter(c=>c.label.toLowerCase().includes(q.toLowerCase())) : cmds.slice(0,9);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'80px 16px' }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:'460px', background:'rgba(6,10,24,0.98)', border:`1px solid ${theme.a1}44`, borderRadius:'20px', overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.85)', animation:'cmdIn 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <Command size={16} color={theme.a1} />
          <input ref={inp} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{ if(e.key==='Escape')onClose(); if(e.key==='Enter'&&list[0])list[0].fn(); }}
            placeholder="Search commands, modes, prompts…"
            style={{ flex:1, background:'none', border:'none', color:'#fff', fontSize:'14px', outline:'none', fontFamily:'inherit', caretColor:theme.a1 }} />
          <kbd style={{ fontSize:'10px', color:'rgba(255,255,255,0.28)', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'5px', padding:'2px 6px', fontFamily:'monospace' }}>ESC</kbd>
        </div>
        <div style={{ maxHeight:'340px', overflowY:'auto' }}>
          {list.length===0 && <div style={{ padding:'22px', textAlign:'center', color:'rgba(255,255,255,0.28)', fontSize:'13px' }}>No commands found</div>}
          {list.map((c,i)=>(
            <div key={i} onClick={c.fn} style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.03)', transition:'background 0.2s' }} className="hover:bg-white/5">
              <span style={{ fontSize:'16px', opacity:0.8 }}>{c.icon}</span>
              <span style={{ fontSize:'13.5px', color:'rgba(255,255,255,0.85)' }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────
export const LiquidChatMode: React.FC = () => {
  const { userProfile, setMicPermissionError, readAloud, ttsVoice } = useSettings();
  const [sessions, setSessions] = useState<any[]>(() => {
    const saved = localStorage.getItem('omnichat_liquid_sessions');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [{ id: '1', name: 'Current Session', messages: [], updatedAt: Date.now() }];
  });
  
  const [currentSession, setCurrentSession] = useState<string>(() => {
    const saved = localStorage.getItem('omnichat_liquid_current_session');
    return saved || '1';
  });

  const activeSession = sessions.find(s => s.id === currentSession) || sessions[0];
  const [messages, setMessages] = useState<any[]>(activeSession?.messages || []);
  const [showHistory, setShowHistory] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);

  useEffect(() => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSession) {
        let name = s.name;
        if (name === 'New Session' || name === 'Current Session') {
          const firstUserMsg = messages.find(m => m.role === 'user');
          if (firstUserMsg) {
            name = firstUserMsg.content.substring(0, 30);
            if (firstUserMsg.content.length > 30) name += '...';
          }
        }
        return { ...s, name, messages, updatedAt: Date.now() };
      }
      return s;
    }));
  }, [messages, currentSession]);

  useEffect(() => {
    localStorage.setItem('omnichat_liquid_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('omnichat_liquid_current_session', currentSession);
    const session = sessions.find(s => s.id === currentSession);
    if (session) {
      setMessages(session.messages || []);
    }
    stopSpeech();
  }, [currentSession]);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  // Listen for + New Chat event from Sidebar
  useEffect(() => {
    const handleNewChat = () => {
      const newSession = { id: Date.now().toString(), name: 'New Session', messages: [], updatedAt: Date.now() };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSession(newSession.id);
      setMessages([]);
    };
    window.addEventListener('omnichat-new-chat', handleNewChat);
    return () => window.removeEventListener('omnichat-new-chat', handleNewChat);
  }, []);

  const createNewSession = () => {
    if (activeSession && activeSession.messages.length === 0) {
      // Already an empty session exists, just keep it focused
      return;
    }
    const newSession = { id: Date.now().toString(), name: 'New Session', messages: [], updatedAt: Date.now() };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSession(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this session?')) {
      const remaining = sessions.filter(s => s.id !== id);
      if (remaining.length === 0) {
        const defaultSession = { id: '1', name: 'New Session', messages: [], updatedAt: Date.now() };
        setSessions([defaultSession]);
        setCurrentSession('1');
      } else {
        setSessions(remaining);
        if (currentSession === id) {
          setCurrentSession(remaining[0].id);
        }
      }
    }
  };

  const [input, setInput, clearInputDraft] = useAutoSaveDraft('omnichat_draft_liquidchat');
  const [status, setStatus] = useState<'idle'|'thinking'|'speaking'|'listening'>('idle');
  const [mode, setMode] = useState('chat');
  const [themeKey, setThemeKey] = useState<keyof typeof T>('void');
  const [showCmd, setShowCmd] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const [selectedModel, setSelectedModel] = useState<'gemini' | 'kimi-k3'>(() => {
    return (localStorage.getItem('omnichat_selected_model_liquid') as 'gemini' | 'kimi-k3') || 'gemini';
  });

  useEffect(() => {
    localStorage.setItem('omnichat_selected_model_liquid', selectedModel);
  }, [selectedModel]);

  const togglePinMessage = (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sounds.playClick();
    triggerHaptic('light');
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pinned: !m.pinned } : m));
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-cyan-400', 'ring-offset-2', 'ring-offset-black', 'rounded-2xl');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-cyan-400', 'ring-offset-2', 'ring-offset-black', 'rounded-2xl');
      }, 2000);
    }
  };

  const pinnedMessages = messages.filter(m => m.pinned);

  // Listen to global workspace assistant text insertion events
  useEffect(() => {
    const handleWorkspaceInsert = (e: Event) => {
      const text = (e as CustomEvent).detail;
      setInput(prev => prev + (prev ? '\n' : '') + text);
    };
    window.addEventListener('workspace-insert-text', handleWorkspaceInsert);
    return () => window.removeEventListener('workspace-insert-text', handleWorkspaceInsert);
  }, []);
  const [tokenTotal, setTokenTotal] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setStatus('thinking');
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64Audio = base64data.split(',')[1];
          
          try {
            const response = await transcribeAudio(base64Audio, audioBlob.type || 'audio/webm');
            if (response.text) {
              setInput((prev) => prev + (prev ? ' ' : '') + response.text);
            }
          } catch (error) {
            console.error('Transcription error:', error);
            alert('Failed to transcribe audio. Please try again.');
          } finally {
            setStatus('idle');
          }
        };
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus('listening');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setMicPermissionError(true);
      setStatus('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const theme = T[themeKey];
  const activeMode = MODES.find(m => m.id === mode) || MODES[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || status !== 'idle') return;
    
    sounds.playClick();
    triggerHaptic('light');

    const userMsgId = Date.now().toString();
    const userMsg = { id: userMsgId, role: 'user', content: input, mode: activeMode.id, timestamp: new Date(), status: 'sent' };
    setMessages(prev => [...prev, userMsg]);
    const inputVal = input;
    clearInputDraft();
    setStatus('thinking');
    setTokenTotal(prev => prev + est(inputVal));

    if (selectedModel === 'kimi-k3') {
      const assistantMsgId = (Date.now() + 1).toString() + '_ast';
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', mode: activeMode.id, timestamp: new Date() }]);
      
      try {
        const { streamKimiK3Response } = await import('../services/kimiK3');
        let thinkingSteps: string[] = [];
        let liveThinking = '';
        let answerText = '';

        const updateUI = () => {
          const stepsPart = thinkingSteps.map(s => `> \`${s}\``).join('\n');
          const reasoningPart = liveThinking ? `\n> \n> 🧠 **Thinking Process:**\n> ${liveThinking.trim().replace(/\n/g, '\n> ')}` : '';
          const formattedThinking = (stepsPart || reasoningPart) ? `${stepsPart}${reasoningPart}\n\n` : '';
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: formattedThinking + answerText } : m));
        };

        await streamKimiK3Response(
          inputVal,
          [],
          {
            onThinkingStep: (stepText, isDone) => {
              thinkingSteps.push(stepText);
              updateUI();
            },
            onThinkingChunk: (chunk) => {
              liveThinking += chunk;
              updateUI();
            },
            onTextChunk: (chunk) => {
              answerText += chunk;
              updateUI();
            },
            onComplete: (full) => {
              answerText = full;
              updateUI();
              setMessages(prev => prev.map(m => m.id === userMsgId ? { ...m, status: 'read' } : m));
              setTokenTotal(prev => prev + est(full));
              sounds.playSuccess();
              triggerHaptic('success');
              
              if (readAloud && full) {
                speakText(full, ttsVoice);
              }
            },
            onError: (err: any) => {
              answerText += `\n\n**Error:** ${err?.message ?? 'Something went wrong.'}`;
              updateUI();
              sounds.playError();
              triggerHaptic('error');
            }
          }
        );
      } catch (error) {
        console.error(error);
        sounds.playError();
        triggerHaptic('error');
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: 'Error loading Kimi-K3 service.' } : m));
      } finally {
        setStatus('idle');
      }
      return;
    }

    try {
      const ai = getAiInstance();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: inputVal,
        config: {
          systemInstruction: activeMode.sys
        }
      });
      
      const replyText = response.text;
      setTokenTotal(prev => prev + est(replyText));
      sounds.playSuccess();
      triggerHaptic('success');

      setMessages(prev => {
        const updated = prev.map(m => m.id === userMsgId ? { ...m, status: 'read' } : m);
        return [...updated, { id: Date.now().toString(), role: 'assistant', content: replyText, mode: activeMode.id, timestamp: new Date() }];
      });
      
      if (readAloud && replyText) {
        speakText(replyText, ttsVoice);
      }
    } catch (error) {
      console.error(error);
      sounds.playError();
      triggerHaptic('error');
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Error generating response.', mode: activeMode.id, timestamp: new Date() }]);
    } finally {
      setStatus('idle');
    }
  };

  const audioRef = useRef<any>(null);

  const handleSpeak = async (text: string) => {
    if (status === 'speaking') {
      if (audioRef.current?.pause) audioRef.current.pause();
      setStatus('idle');
      return;
    }
    try {
      setStatus('thinking');
      const response = await generateSpeech(text, 'Zephyr');
      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      
      if (inlineData && inlineData.data) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        const binaryString = window.atob(inlineData.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const pcm16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
          float32[i] = pcm16[i] / 32768.0;
        }
        
        const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
        audioBuffer.getChannelData(0).set(float32);
        
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => setStatus('idle');
        source.start(0);
        
        audioRef.current = { pause: () => { source.stop(); audioCtx.close(); } };
        setStatus('speaking');
      } else {
        setStatus('idle');
      }
    } catch (error) {
      console.error('Speech generation error:', error);
      setStatus('idle');
    }
  };

  const handleAction = (action: string, payload?: any) => {
    if (action === 'clear') setMessages([]);
    if (action === 'prompt') setInput(payload);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.bg, color: '#fff', position: 'relative', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes scan { 0% { transform: translateY(-100%); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateY(100vh); opacity: 0; } }
        @keyframes statusBar { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.4); } }
        @keyframes popIn { 0% { opacity: 0; transform: scale(0.95) translateY(10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes cmdIn { 0% { opacity: 0; transform: scale(0.98) translateY(-20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .glass-panel { background: rgba(10, 15, 30, 0.4); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
        .hide-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      
      <NeuralGrid active={status === 'thinking'} a1={theme.a1} />
      {status === 'thinking' && <ScanLine color={theme.a1} />}

      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `linear-gradient(135deg, ${theme.a1}, ${theme.a2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 20px ${theme.a1}40` }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', background: `linear-gradient(90deg, #fff, ${theme.a1})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RISHI</h1>
            <StatusBars status={status} color={theme.a1} />
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as 'gemini' | 'kimi-k3')}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '12px',
              padding: '8px 10px',
              cursor: 'pointer',
              outline: 'none',
              marginRight: '4px'
            }}
          >
            <option value="gemini" style={{ background: '#111' }}>♊ Gemini 3.5</option>
            <option value="kimi-k3" style={{ background: '#111' }}>👑 Kimi-K3</option>
          </select>
          <button onClick={() => setShowHistory(!showHistory)} style={{ width: '36px', height: '36px', borderRadius: '10px', background: showHistory ? `${theme.a1}20` : 'rgba(255,255,255,0.05)', border: `1px solid ${showHistory ? theme.a1 : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: showHistory ? theme.a1 : 'rgba(255,255,255,0.7)', cursor: 'pointer' }} title="Toggle Chat History">
            <MessageSquare size={16} />
          </button>
          <button onClick={createNewSession} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', background: `rgba(255,255,255,0.05)`, border: `1px solid ${theme.a1}40`, color: theme.a1, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> New
          </button>
        </div>
      </div>

      {/* Main Content Area with Optional Sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 10 }}>
        {/* Chat Column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Modes Bar */}
      <div className="hide-scroll" style={{ padding: '0 20px 10px', display: 'flex', gap: '8px', overflowX: 'auto', zIndex: 10 }}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '100px', background: mode === m.id ? `${m.color}20` : 'rgba(255,255,255,0.03)', border: `1px solid ${mode === m.id ? m.color : 'rgba(255,255,255,0.05)'}`, color: mode === m.id ? m.color : 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
            <m.icon size={14} /> {m.label}
          </button>
        ))}
      </div>

      {/* Pinned Messages Bar */}
      {pinnedMessages.length > 0 && (
        <div className="shrink-0 border-b border-white/10 bg-black/40 backdrop-blur-md px-4 py-2 flex flex-col gap-1.5 z-10">
          <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
            <div className="flex items-center gap-1.5">
              <Pin size={13} className="text-cyan-400 fill-cyan-400/40" />
              <span>Anchored / Pinned Messages ({pinnedMessages.length})</span>
            </div>
            <button 
              onClick={() => setMessages(prev => prev.map(m => ({ ...m, pinned: false })))}
              className="text-[10px] text-cyan-400/70 hover:text-cyan-200 underline transition-colors"
            >
              Unpin All
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto py-1 hide-scrollbar">
            {pinnedMessages.map((pm) => (
              <div
                key={pm.id}
                onClick={() => scrollToMessage(pm.id)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-black/60 text-xs text-white shrink-0 max-w-[280px] cursor-pointer hover:bg-black/80 transition-all group shadow-sm"
              >
                <span className="shrink-0 font-bold text-[10px] uppercase text-cyan-300">
                  {pm.role === 'user' ? 'You' : 'Rishi'}:
                </span>
                <span className="truncate flex-1 text-slate-200 text-[11px]">
                  {pm.content || 'Pinned message'}
                </span>
                <button
                  onClick={(e) => togglePinMessage(pm.id, e)}
                  className="p-1 rounded-md text-cyan-400/60 hover:text-red-300 hover:bg-red-500/20 transition-all"
                  title="Unpin message"
                >
                  <PinOff size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="hide-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.5 }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>{theme.e}</div>
            <h2 style={{ fontSize: '24px', fontWeight: 300, margin: '0 0 8px' }}>How can I help you today?</h2>
            <p style={{ fontSize: '14px', margin: 0 }}>Select a mode or just start typing.</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const msgTime = msg.timestamp ? new Date(msg.timestamp) : null;
            
            return (
              <motion.div 
                key={msg.id}
                id={`msg-${msg.id}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', width: '100%', position: 'relative' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', opacity: 0.6 }}>
                  {isUser ? (
                    <>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{userProfile.name || 'You'}</span>
                      {userProfile.avatarUrl ? (
                        <img src={userProfile.avatarUrl} alt="User" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                      ) : (
                        <User size={12} />
                      )}
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} color={activeMode.color} />
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Rishi</span>
                    </>
                  )}
                  <button
                    onClick={(e) => togglePinMessage(msg.id, e)}
                    style={{ background: 'none', border: 'none', color: msg.pinned ? activeMode.color : 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                    title={msg.pinned ? "Unpin message" : "Pin message to top"}
                  >
                    {msg.pinned ? <Pin size={12} className="fill-current" /> : <Pin size={12} />}
                  </button>
                </div>
                <div style={{ maxWidth: '85%', padding: '16px 20px', borderRadius: '20px', background: isUser ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.4)', border: `1px solid ${isUser ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}`, borderBottomRightRadius: isUser ? '4px' : '20px', borderBottomLeftRadius: !isUser ? '4px' : '20px', fontSize: '14.5px', lineHeight: 1.6, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', position: 'relative' }}>
                  {msg.pinned && (
                    <div 
                      className="absolute -top-2 -right-2 bg-cyan-500 text-black p-1 rounded-full shadow-lg border border-cyan-300 z-10 flex items-center justify-center"
                      title="Pinned message"
                    >
                      <Pin size={10} className="fill-black" />
                    </div>
                  )}
                  {isUser ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  ) : (
                    <>
                      <MD text={msg.content} accent={activeMode.color} />
                      {msg.mode === 'code' && <Playground code={msg.content} accent={activeMode.color} />}
                    </>
                  )}
                </div>
                {msgTime && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', opacity: 0.5, fontSize: '10px' }}>
                    <span>{msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isUser ? (
                      <span title={msg.status || 'sent'}>
                        {msg.status === 'read' ? (
                          <CheckCheck size={10} color={activeMode.color} />
                        ) : msg.status === 'delivered' ? (
                          <CheckCheck size={10} />
                        ) : (
                          <Check size={10} />
                        )}
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleSpeak(msg.content)}
                        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                        title="Read Aloud"
                      >
                        <Volume2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>

            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ padding: '20px', zIndex: 10 }}>
        {showWorkspace && (
          <div style={{ marginBottom: '12px', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <WorkspaceWidget 
              onInsertText={(text) => {}} // globally handled via workspace-insert-text event
              onClose={() => setShowWorkspace(false)}
            />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px 8px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
          <span>~{est(input)} tok</span>
          <span>{tokenTotal} sent • {costStr(tokenTotal)}</span>
        </div>
        <div className="glass-panel" style={{ borderRadius: '24px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={status === 'listening' ? "Listening..." : `${activeMode.label} mode — message Rishi...`}
              disabled={status === 'listening'}
              style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: '15px', resize: 'none', outline: 'none', minHeight: '44px', maxHeight: '120px', padding: '10px 4px', fontFamily: 'inherit' }}
              rows={1}
            />
            <div style={{ display: 'flex', gap: '8px', padding: '4px 0' }}>
              <button 
                onClick={isRecording ? stopRecording : startRecording}
                style={{ width: '36px', height: '36px', borderRadius: '12px', background: isRecording ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isRecording ? '#ef4444' : 'rgba(255,255,255,0.6)', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                {isRecording ? <Square size={18} className="fill-current" /> : <Mic size={18} />}
              </button>
              <button 
                onClick={() => setShowWorkspace(!showWorkspace)}
                style={{ width: '36px', height: '36px', borderRadius: '12px', background: showWorkspace ? `${theme.a1}22` : 'rgba(255,255,255,0.05)', border: showWorkspace ? `1px solid ${theme.a1}44` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showWorkspace ? theme.a1 : 'rgba(255,255,255,0.6)', cursor: 'pointer', transition: 'all 0.2s' }}
                title="Google Workspace Assistant"
              >
                <Briefcase size={18} />
              </button>
              <button onClick={handleSend} disabled={!input.trim() || status !== 'idle'} style={{ width: '36px', height: '36px', borderRadius: '12px', background: input.trim() ? theme.a1 : 'rgba(255,255,255,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: input.trim() ? '#000' : 'rgba(255,255,255,0.3)', cursor: input.trim() ? 'pointer' : 'default', transition: 'all 0.2s' }}>
                <Send size={16} style={{ transform: 'translateX(1px) translateY(1px)' }} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
            <span>↵ send</span>
            <span>⇧↵ newline</span>
            <span>⌘K commands</span>
          </div>
        </div>
      </div>

      </div> {/* closes Chat Column */}

      {/* Sidebar History Panel */}
      <AnimatePresence initial={false}>
        {showHistory && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="glass-panel" 
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'flex-end',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(10, 15, 30, 0.6)',
              backdropFilter: 'blur(20px)',
              height: '100%',
              overflow: 'hidden',
              willChange: 'width, opacity'
            }}
          >
            <div style={{ width: 260, display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
              <div style={{ padding: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.a1 }}>Sessions</span>
                <button 
                  onClick={createNewSession}
                  style={{ background: 'none', border: 'none', color: theme.a1, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="New Session"
                >
                  <Plus size={15} />
                </button>
              </div>
              <div className="hide-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sessions.map(s => (
                  <div 
                    key={s.id}
                    onClick={() => setCurrentSession(s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: s.id === currentSession ? 'rgba(255,255,255,0.06)' : 'transparent',
                      border: `1px solid ${s.id === currentSession ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
                      transition: 'all 0.2s',
                      minWidth: 0
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                      <MessageSquare size={14} style={{ color: theme.a1, opacity: 0.7, flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', color: s.id === currentSession ? '#fff' : 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                    </div>
                    <button 
                      onClick={(e) => deleteSession(s.id, e)}
                      style={{ background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.7)', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                      title="Delete Session"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div> {/* closes Main Content Area with Optional Sidebar */}

      {showCmd && <CmdPalette theme={theme} onAction={handleAction} onClose={() => setShowCmd(false)} sessions={sessions} setSession={setCurrentSession} setMode={setMode} />}
    </div>
  );
}
