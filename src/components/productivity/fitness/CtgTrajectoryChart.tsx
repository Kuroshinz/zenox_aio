import React, { useState, useMemo } from 'react';
import { TrendingUp, Scale, Flame, Award, Eye, Calendar, Sparkles } from 'lucide-react';
import { CtgRoadmapPhase } from '../../../types/productivity';

interface CtgTrajectoryChartProps {
  phases: CtgRoadmapPhase[];
  currentWeight: number;
  currentBf: number;
  currentLbm: number;
  activePhaseId?: string;
  onSelectPhase?: (phaseId: string) => void;
  lang?: 'vi' | 'en';
}

export const CtgTrajectoryChart: React.FC<CtgTrajectoryChartProps> = ({
  phases,
  currentWeight,
  currentBf,
  currentLbm,
  activePhaseId,
  onSelectPhase,
  lang = 'vi',
}) => {
  const [metricMode, setMetricMode] = useState<'all' | 'weight' | 'bodyFat' | 'lbm'>('all');
  const [hoveredPhase, setHoveredPhase] = useState<CtgRoadmapPhase | null>(null);

  // Compute total duration and data points for the trajectory
  const { totalWeeks, points, phaseSlices, minWeight, maxWeight, minBf, maxBf, minLbm, maxLbm } = useMemo(() => {
    if (!phases || phases.length === 0) {
      return {
        totalWeeks: 0,
        points: [],
        phaseSlices: [],
        minWeight: 50,
        maxWeight: 90,
        minBf: 8,
        maxBf: 25,
        minLbm: 40,
        maxLbm: 75,
      };
    }

    const tWeeks = phases.reduce((acc, p) => acc + (p.weeks || 4), 0);
    let accumWeeks = 0;

    interface TrajectoryPoint {
      phaseIndex: number;
      weekOffset: number;
      xPct: number;
      weightKg: number;
      bodyFatPct: number;
      lbmKg: number;
      ffmi: number;
      phase: CtgRoadmapPhase;
      isEnd: boolean;
    }

    const pts: TrajectoryPoint[] = [];
    const slices: {
      phase: CtgRoadmapPhase;
      startXPct: number;
      endXPct: number;
      weeks: number;
      isActive: boolean;
    }[] = [];

    // Initial point from first phase
    const firstP = phases[0];
    pts.push({
      phaseIndex: 0,
      weekOffset: 0,
      xPct: 0,
      weightKg: firstP.startWeightKg,
      bodyFatPct: firstP.startBodyFatPct,
      lbmKg: firstP.startLbmKg,
      ffmi: firstP.startFfmi,
      phase: firstP,
      isEnd: false,
    });

    phases.forEach((p, idx) => {
      const pWeeks = p.weeks || 4;
      const startX = tWeeks > 0 ? accumWeeks / tWeeks : 0;
      accumWeeks += pWeeks;
      const endX = tWeeks > 0 ? accumWeeks / tWeeks : 1;

      slices.push({
        phase: p,
        startXPct: startX,
        endXPct: endX,
        weeks: pWeeks,
        isActive: p.id === activePhaseId,
      });

      pts.push({
        phaseIndex: idx,
        weekOffset: accumWeeks,
        xPct: endX,
        weightKg: p.targetWeightKg,
        bodyFatPct: p.targetBodyFatPct,
        lbmKg: p.targetLbmKg,
        ffmi: p.targetFfmi,
        phase: p,
        isEnd: true,
      });
    });

    const weights = pts.map((pt) => pt.weightKg).concat([currentWeight]);
    const bfs = pts.map((pt) => pt.bodyFatPct).concat([currentBf]);
    const lbms = pts.map((pt) => pt.lbmKg).concat([currentLbm]);

    const minW = Math.floor(Math.min(...weights) - 1.5);
    const maxW = Math.ceil(Math.max(...weights) + 1.5);

    const minB = Math.floor(Math.min(...bfs) - 1.5);
    const maxB = Math.ceil(Math.max(...bfs) + 1.5);

    const minL = Math.floor(Math.min(...lbms) - 1.5);
    const maxL = Math.ceil(Math.max(...lbms) + 1.5);

    return {
      totalWeeks: tWeeks,
      points: pts,
      phaseSlices: slices,
      minWeight: minW,
      maxWeight: maxW,
      minBf: minB,
      maxBf: maxB,
      minLbm: minL,
      maxLbm: maxL,
    };
  }, [phases, currentWeight, currentBf, currentLbm, activePhaseId]);

  if (!phases || phases.length === 0) return null;

  const svgWidth = 800;
  const svgHeight = 260;
  const padLeft = 45;
  const padRight = 45;
  const padTop = 38;
  const padBottom = 38;
  const graphW = svgWidth - padLeft - padRight;
  const graphH = svgHeight - padTop - padBottom;

  const mapX = (xPct: number) => padLeft + xPct * graphW;
  const mapYWeight = (w: number) => {
    const range = Math.max(1, maxWeight - minWeight);
    return padTop + graphH - ((w - minWeight) / range) * graphH;
  };
  const mapYBodyFat = (bf: number) => {
    const range = Math.max(1, maxBf - minBf);
    return padTop + graphH - ((bf - minBf) / range) * graphH;
  };
  const mapYLbm = (l: number) => {
    const range = Math.max(1, maxLbm - minLbm);
    return padTop + graphH - ((l - minLbm) / range) * graphH;
  };

  const weightPointsCoords = points.map((pt) => ({ x: mapX(pt.xPct), y: mapYWeight(pt.weightKg) }));
  const bfPointsCoords = points.map((pt) => ({ x: mapX(pt.xPct), y: mapYBodyFat(pt.bodyFatPct) }));
  const lbmPointsCoords = points.map((pt) => ({ x: mapX(pt.xPct), y: mapYLbm(pt.lbmKg) }));

  const buildPathString = (coords: { x: number; y: number }[]) => {
    if (coords.length === 0) return '';
    return coords.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');
  };

  const weightPathD = buildPathString(weightPointsCoords);
  const bfPathD = buildPathString(bfPointsCoords);
  const lbmPathD = buildPathString(lbmPointsCoords);

  const weightAreaD =
    weightPointsCoords.length > 0
      ? `${weightPathD} L ${weightPointsCoords[weightPointsCoords.length - 1].x} ${padTop + graphH} L ${weightPointsCoords[0].x} ${padTop + graphH} Z`
      : '';

  const activeSlice = phaseSlices.find((s) => s.isActive) || phaseSlices[0];
  const currentMarkerXPct = activeSlice ? (activeSlice.startXPct + activeSlice.endXPct) / 2 : 0.1;
  const currentMarkerX = mapX(currentMarkerXPct);
  const currentMarkerY = mapYWeight(currentWeight);

  return (
    <div className="bg-[#090306] rounded-3xl border border-white/10 p-5 sm:p-6 shadow-2xl relative overflow-hidden space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Biểu Đồ Chu Kỳ Chuyển Hóa CTG
            </span>
            <span className="text-xs font-mono text-white/50">
              ~{totalWeeks} Tuần · {phases.length} Giai đoạn
            </span>
          </div>
          <h4 className="text-base sm:text-lg font-black text-white mt-1 tracking-tight flex items-center gap-2">
            <span>Đường Cong Dự Phóng Thể Hình (Macrocycle Trajectory)</span>
          </h4>
        </div>

        {/* Metric Selector Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setMetricMode('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              metricMode === 'all'
                ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('weight')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              metricMode === 'weight'
                ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
            }`}
          >
            Cân nặng (kg)
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('bodyFat')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              metricMode === 'bodyFat'
                ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
            }`}
          >
            % Mỡ cơ thể
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('lbm')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              metricMode === 'lbm'
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
            }`}
          >
            Khối nạc (LBM)
          </button>
        </div>
      </div>

      {/* SVG Interactive Trajectory Graph */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-black/40 border border-white/5">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-[300px] select-none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>

            <linearGradient id="bulkSliceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="cutSliceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="maintainSliceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* 1. Background Grid & Phase Slices */}
          {phaseSlices.map((slice, idx) => {
            const x = mapX(slice.startXPct);
            const w = mapX(slice.endXPct) - x;
            const isBulk = slice.phase.phaseType === 'bulk';
            const isCut = slice.phase.phaseType === 'cut' || slice.phase.phaseType === 'minicut' || slice.phase.phaseType === 'final_cut';
            const sliceGrad = isBulk ? 'url(#bulkSliceGrad)' : isCut ? 'url(#cutSliceGrad)' : 'url(#maintainSliceGrad)';

            return (
              <g
                key={slice.phase.id}
                className="cursor-pointer transition-opacity hover:opacity-100"
                onClick={() => onSelectPhase?.(slice.phase.id)}
                onMouseEnter={() => setHoveredPhase(slice.phase)}
                onMouseLeave={() => setHoveredPhase(null)}
              >
                <rect
                  x={x}
                  y={padTop}
                  width={w}
                  height={graphH}
                  fill={sliceGrad}
                  stroke={slice.isActive ? 'rgba(244,63,94,0.6)' : 'rgba(255,255,255,0.06)'}
                  strokeWidth={slice.isActive ? 1.5 : 0.8}
                />

                <text
                  x={x + w / 2}
                  y={padTop - 12}
                  textAnchor="middle"
                  fill={slice.isActive ? '#f43f5e' : 'rgba(255,255,255,0.6)'}
                  fontSize="11"
                  fontWeight={slice.isActive ? 'bold' : 'normal'}
                  fontFamily="system-ui, sans-serif"
                >
                  #{idx + 1} {slice.phase.name.includes('Tăng cơ') ? 'Tăng cơ' : slice.phase.name.includes('Mini-cut') ? 'Mini-cut' : slice.phase.name.includes('Giảm mỡ') ? 'Giảm mỡ' : slice.phase.name}
                </text>

                <text
                  x={x + w / 2}
                  y={padTop + graphH + 20}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.4)"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {slice.weeks}w
                </text>
              </g>
            );
          })}

          {/* Horizontal Reference Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
            const y = padTop + p * graphH;
            return (
              <line
                key={i}
                x1={padLeft}
                y1={y}
                x2={padLeft + graphW}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeDasharray="4,4"
              />
            );
          })}

          {/* 2. Weight Area Fill */}
          {(metricMode === 'all' || metricMode === 'weight') && (
            <path d={weightAreaD} fill="url(#weightAreaGrad)" />
          )}

          {/* 3. Curves */}
          {(metricMode === 'all' || metricMode === 'lbm') && (
            <path
              d={lbmPathD}
              fill="none"
              stroke="#818cf8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {(metricMode === 'all' || metricMode === 'bodyFat') && (
            <path
              d={bfPathD}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeDasharray="6,4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {(metricMode === 'all' || metricMode === 'weight') && (
            <path
              d={weightPathD}
              fill="none"
              stroke="#f43f5e"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="drop-shadow(0 0 6px rgba(244,63,94,0.6))"
            />
          )}

          {/* 4. Point Markers */}
          {points.map((pt, i) => {
            const x = mapX(pt.xPct);
            const yW = mapYWeight(pt.weightKg);
            const yBf = mapYBodyFat(pt.bodyFatPct);
            const yLbm = mapYLbm(pt.lbmKg);

            return (
              <g key={i}>
                {(metricMode === 'all' || metricMode === 'weight') && (
                  <circle cx={x} cy={yW} r="4" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
                )}
                {(metricMode === 'all' || metricMode === 'bodyFat') && (
                  <circle cx={x} cy={yBf} r="3" fill="#f59e0b" stroke="#fff" strokeWidth="1" />
                )}
                {(metricMode === 'all' || metricMode === 'lbm') && (
                  <circle cx={x} cy={yLbm} r="3" fill="#818cf8" stroke="#fff" strokeWidth="1" />
                )}
              </g>
            );
          })}

          {/* 5. You Are Here Marker */}
          <g>
            <line
              x1={currentMarkerX}
              y1={padTop}
              x2={currentMarkerX}
              y2={padTop + graphH}
              stroke="rgba(16,185,129,0.5)"
              strokeDasharray="3,3"
              strokeWidth="1.5"
            />
            <circle
              cx={currentMarkerX}
              cy={currentMarkerY}
              r="8"
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
              opacity="0.8"
            />
            <circle
              cx={currentMarkerX}
              cy={currentMarkerY}
              r="4.5"
              fill="#10b981"
              stroke="#fff"
              strokeWidth="1.5"
            />
          </g>
        </svg>

        {/* Floating Badge */}
        <div
          className="absolute z-10 pointer-events-none transform -translate-x-1/2 -translate-y-full px-2.5 py-1 rounded-full bg-emerald-950/90 border border-emerald-400/50 text-[10px] font-mono text-emerald-200 font-bold shadow-lg shadow-black/80 flex items-center gap-1.5"
          style={{
            left: `${(currentMarkerX / svgWidth) * 100}%`,
            top: `${Math.max(10, ((currentMarkerY - 14) / svgHeight) * 100)}%`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Hiện tại: ${currentWeight}kg (${currentBf}%)</span>
        </div>
      </div>

      {/* Legend & Hover preview */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 font-mono text-rose-300">
            <span className="w-3 h-1 bg-rose-500 rounded-full" />
            <span>Cân nặng đích (${minWeight} → ${maxWeight} kg)</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-amber-300">
            <span className="w-3 h-0.5 border-t border-dashed border-amber-400" />
            <span>% Mỡ dự phóng (${minBf}% → ${maxBf}%)</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-indigo-300">
            <span className="w-3 h-1 bg-indigo-400 rounded-full" />
            <span>Khối nạc LBM (${minLbm} → ${maxLbm} kg)</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Mốc hiện tại</span>
          </div>
        </div>

        {hoveredPhase && (
          <div className="text-[11px] font-mono text-white/70 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 animate-fadeIn">
            Đang xem: <strong>${hoveredPhase.name}</strong> (${hoveredPhase.weeks}w): ${hoveredPhase.startWeightKg}kg → ${hoveredPhase.targetWeightKg}kg · ${hoveredPhase.targetKcal} kcal
          </div>
        )}
      </div>
    </div>
  );
};
