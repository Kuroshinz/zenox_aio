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

// Convert discrete points to a smooth cubic Bezier SVG path
function getSmoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  if (coords.length === 2) {
    return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)} L ${coords[1].x.toFixed(1)} ${coords[1].y.toFixed(1)}`;
  }

  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? 0 : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
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
      phaseIndex: number;
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
        phaseIndex: idx,
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

  const svgWidth = 840;
  const svgHeight = 280;
  const padLeft = 52;
  const padRight = 50;
  const padTop = 44;
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

  const weightCoords = points.map((pt) => ({ x: mapX(pt.xPct), y: mapYWeight(pt.weightKg) }));
  const bfCoords = points.map((pt) => ({ x: mapX(pt.xPct), y: mapYBodyFat(pt.bodyFatPct) }));
  const lbmCoords = points.map((pt) => ({ x: mapX(pt.xPct), y: mapYLbm(pt.lbmKg) }));

  const weightPathD = getSmoothPath(weightCoords);
  const bfPathD = getSmoothPath(bfCoords);
  const lbmPathD = getSmoothPath(lbmCoords);

  const weightAreaD =
    weightCoords.length > 0
      ? `${weightPathD} L ${weightCoords[weightCoords.length - 1].x.toFixed(1)} ${padTop + graphH} L ${weightCoords[0].x.toFixed(1)} ${padTop + graphH} Z`
      : '';

  // Current Beacon Position
  const activeSlice = phaseSlices.find((s) => s.isActive) || phaseSlices[0];
  const currentMarkerXPct = activeSlice ? (activeSlice.startXPct + activeSlice.endXPct) / 2 : 0.05;
  const currentMarkerX = mapX(currentMarkerXPct);
  const currentMarkerY = mapYWeight(currentWeight);

  // Determine clamped X for the in-svg beacon pill so it never clips outside edges
  const pillW = 145;
  const pillX = Math.max(padLeft + pillW / 2, Math.min(svgWidth - padRight - pillW / 2, currentMarkerX));
  const pillY = Math.max(padTop + 14, currentMarkerY - 14);

  // Determine whether slices are dense
  const isDense = phases.length > 8;
  const isSuperDense = phases.length > 14;

  return (
    <div className="bg-[#090306] rounded-3xl border border-white/10 p-5 sm:p-6 shadow-2xl relative overflow-hidden space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Biểu Đồ Chu Kỳ Chuyển Hóa ZENOX
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

      {/* SVG Container */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.28" />
              <stop offset="65%" stopColor="#f43f5e" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="bulkSliceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="cutSliceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
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
            const isHovered = hoveredPhase?.id === slice.phase.id;

            // Smart label formatting: avoid squished text collisions!
            let labelText = '';
            if (slice.isActive) {
              labelText = `#${idx + 1} Đang Chạy`;
            } else if (!isDense) {
              const shortName = slice.phase.name.includes('Tăng') ? 'Tăng cơ' : slice.phase.name.includes('Mini') ? 'Mini-cut' : slice.phase.name.includes('Giảm') ? 'Giảm mỡ' : slice.phase.name;
              labelText = `#${idx + 1} ${shortName}`;
            } else if (isSuperDense) {
              // When > 14 phases, only show odd numbers #1, #3, #5... unless active or hovered
              labelText = (idx % 2 === 0 || isHovered) ? `#${idx + 1}` : '';
            } else {
              labelText = `#${idx + 1}`;
            }

            return (
              <g
                key={slice.phase.id}
                className="cursor-pointer transition-opacity"
                onClick={() => onSelectPhase?.(slice.phase.id)}
                onMouseEnter={() => setHoveredPhase(slice.phase)}
                onMouseLeave={() => setHoveredPhase(null)}
              >
                {/* Vertical Slice Background */}
                <rect
                  x={x}
                  y={padTop}
                  width={w}
                  height={graphH}
                  fill={sliceGrad}
                  stroke={slice.isActive ? 'rgba(244,63,94,0.7)' : isHovered ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.06)'}
                  strokeWidth={slice.isActive ? 2 : isHovered ? 1.5 : 0.8}
                />

                {/* Phase Header Label */}
                {labelText && (
                  slice.isActive ? (
                    <g>
                      <rect
                        x={x + w / 2 - 38}
                        y={padTop - 25}
                        width="76"
                        height="18"
                        rx="9"
                        fill="#f43f5e"
                        filter="drop-shadow(0 2px 4px rgba(244,63,94,0.4))"
                      />
                      <text
                        x={x + w / 2}
                        y={padTop - 13}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="9.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {labelText}
                      </text>
                    </g>
                  ) : (
                    <text
                      x={x + w / 2}
                      y={padTop - 12}
                      textAnchor="middle"
                      fill={isHovered ? '#ffffff' : 'rgba(255,255,255,0.45)'}
                      fontSize={isSuperDense ? '9.5' : '10.5'}
                      fontWeight={isHovered ? 'bold' : 'normal'}
                      fontFamily="monospace"
                    >
                      {labelText}
                    </text>
                  )
                )}

                {/* Duration text at bottom (only show if slice is wide enough or on hover) */}
                {(w >= 28 || isHovered) && (
                  <text
                    x={x + w / 2}
                    y={padTop + graphH + 18}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.35)"
                    fontSize="9.5"
                    fontFamily="monospace"
                  >
                    {slice.weeks}w
                  </text>
                )}
              </g>
            );
          })}

          {/* Horizontal Reference Lines and Y-Axis Labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
            const y = padTop + p * graphH;
            const wVal = Math.round(maxWeight - p * (maxWeight - minWeight));
            const bfVal = Math.round(maxBf - p * (maxBf - minBf));

            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + graphW}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4,4"
                />

                {/* Left Y Axis: Weight */}
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="rgba(244,63,94,0.6)"
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {wVal}
                </text>

                {/* Right Y Axis: % Body Fat */}
                <text
                  x={padLeft + graphW + 8}
                  y={y + 3.5}
                  textAnchor="start"
                  fill="rgba(245,158,11,0.6)"
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {bfVal}%
                </text>
              </g>
            );
          })}

          {/* 2. Weight Area Fill */}
          {(metricMode === 'all' || metricMode === 'weight') && (
            <path d={weightAreaD} fill="url(#weightAreaGrad)" />
          )}

          {/* 3. Smooth Spline Curves */}
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
              strokeWidth="2.2"
              strokeDasharray="5,3"
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
              filter="drop-shadow(0 0 6px rgba(244,63,94,0.5))"
            />
          )}

          {/* 4. Trajectory Point Markers */}
          {points.map((pt, i) => {
            const x = mapX(pt.xPct);
            const yW = mapYWeight(pt.weightKg);
            const yBf = mapYBodyFat(pt.bodyFatPct);
            const yLbm = mapYLbm(pt.lbmKg);

            return (
              <g key={i}>
                {(metricMode === 'all' || metricMode === 'weight') && (
                  <circle cx={x} cy={yW} r="3.5" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
                )}
                {(metricMode === 'all' || metricMode === 'bodyFat') && (
                  <circle cx={x} cy={yBf} r="2.8" fill="#f59e0b" stroke="#fff" strokeWidth="1" />
                )}
                {(metricMode === 'all' || metricMode === 'lbm') && (
                  <circle cx={x} cy={yLbm} r="2.8" fill="#818cf8" stroke="#fff" strokeWidth="1" />
                )}
              </g>
            );
          })}

          {/* 5. You Are Here Active Marker & Non-Clipping SVG Pill */}
          <g>
            {/* Vertical Guide Line */}
            <line
              x1={currentMarkerX}
              y1={padTop}
              x2={currentMarkerX}
              y2={padTop + graphH}
              stroke="rgba(16,185,129,0.5)"
              strokeDasharray="3,3"
              strokeWidth="1.5"
            />

            {/* Glowing Rings */}
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
              stroke="#ffffff"
              strokeWidth="1.5"
            />

            {/* In-SVG Clamped Floating Pill */}
            <g>
              <rect
                x={pillX - pillW / 2}
                y={pillY - 14}
                width={pillW}
                height="22"
                rx="11"
                fill="#042f22"
                stroke="#10b981"
                strokeWidth="1.2"
                filter="drop-shadow(0 2px 6px rgba(0,0,0,0.8))"
              />
              <circle
                cx={pillX - pillW / 2 + 12}
                cy={pillY - 3}
                r="3"
                fill="#34d399"
              />
              <text
                x={pillX + 5}
                y={pillY}
                textAnchor="middle"
                fill="#6ee7b7"
                fontSize="9.5"
                fontWeight="bold"
                fontFamily="monospace"
              >
                Hiện tại: {currentWeight}kg ({currentBf}%)
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* Legend & Hover preview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-1 border-t border-white/5">
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 font-mono text-rose-300">
            <span className="w-3 h-1 bg-rose-500 rounded-full" />
            <span>Cân nặng ({minWeight} → {maxWeight} kg)</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-amber-300">
            <span className="w-3 h-0.5 border-t border-dashed border-amber-400" />
            <span>% Mỡ ({minBf}% → {maxBf}%)</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-indigo-300">
            <span className="w-3 h-1 bg-indigo-400 rounded-full" />
            <span>Khối nạc LBM ({minLbm} → {maxLbm} kg)</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Mốc hiện tại</span>
          </div>
        </div>

        {hoveredPhase && (
          <div className="text-[11px] font-mono text-white/80 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 animate-fadeIn">
            Đang xem: <strong className="text-rose-400">#{phases.findIndex((p) => p.id === hoveredPhase.id) + 1} {hoveredPhase.name}</strong> ({hoveredPhase.weeks}w): {hoveredPhase.startWeightKg}kg → {hoveredPhase.targetWeightKg}kg · {hoveredPhase.targetKcal} kcal
          </div>
        )}
      </div>
    </div>
  );
};
