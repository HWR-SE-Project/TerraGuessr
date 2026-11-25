import { useState } from 'react'
import type { PlayerStatistics } from '../../lib/contracts'
import { formatDistance, formatScore } from '../../lib/format'
import { formatShortDate } from './statsLabels'

type MetricKey = 'score' | 'distance'

const WIDTH = 680
const HEIGHT = 220
const PAD_X = 44
const PAD_TOP = 18
const PAD_BOTTOM = 30

export function PerformanceChart({ trend }: { trend: PlayerStatistics['trend'] }) {
  const [metric, setMetric] = useState<MetricKey>('score')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const points = trend.points
  const plotW = WIDTH - PAD_X * 2
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM

  const validDistancePoints = points.filter((p) => p.medianDistanceKm !== null)
  const activePoints = metric === 'score' ? points : validDistancePoints

  const maxY =
    metric === 'score'
      ? 5000
      : Math.max(
          500,
          ...activePoints.map((p) => p.medianDistanceKm ?? 0),
        )

  const xFor = (index: number, count: number) =>
    count <= 1 ? PAD_X + plotW / 2 : PAD_X + (index / (count - 1)) * plotW

  const yFor = (val: number) => {
    const ratio = Math.min(1, Math.max(0, val / maxY))
    return PAD_TOP + plotH - ratio * plotH
  }

  const coords = activePoints.map((point, index) => {
    const rawVal = metric === 'score' ? point.averageScore : (point.medianDistanceKm ?? 0)
    const rollingVal = metric === 'score' ? point.rollingAverageScore : rawVal
    return {
      point,
      x: xFor(index, activePoints.length),
      yRaw: yFor(rawVal),
      yMain: yFor(rollingVal),
    }
  })

  const mainLinePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yMain.toFixed(1)}`)
    .join(' ')

  const rawLinePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.yRaw.toFixed(1)}`)
    .join(' ')

  const areaPath =
    coords.length >= 2
      ? `${mainLinePath} L ${coords[coords.length - 1]!.x.toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} L ${coords[0]!.x.toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} Z`
      : ''

  const yTicks =
    metric === 'score'
      ? [0, 2500, 5000]
      : [0, Math.round(maxY / 2), Math.round(maxY)]

  const hovered =
    activeIndex !== null && coords[activeIndex] ? coords[activeIndex]! : null

  const labelStep = Math.max(1, Math.ceil(coords.length / 6))

  return (
    <section className="surface p-5 sm:p-6" aria-label="Performance trend">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-cream">Performance over time</h2>
          <p className="text-xs text-subtle">
            {trend.granularity === 'day' ? 'Daily buckets' : 'Weekly buckets'}
            {metric === 'score' ? ' · Solid line shows 3-period rolling average' : ' · Lower distance is better'}
          </p>
        </div>

        <div
          className="inline-flex rounded-full border border-white/10 bg-space-800 p-1"
          role="group"
          aria-label="Chart metric"
        >
          <button
            type="button"
            onClick={() => {
              setMetric('score')
              setActiveIndex(null)
            }}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              metric === 'score'
                ? 'bg-lime-400/20 text-lime-300'
                : 'text-muted hover:text-cream'
            }`}
          >
            Score
          </button>
          <button
            type="button"
            onClick={() => {
              setMetric('distance')
              setActiveIndex(null)
            }}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              metric === 'distance'
                ? 'bg-sky-400/20 text-sky-300'
                : 'text-muted hover:text-cream'
            }`}
          >
            Median km
          </button>
        </div>
      </div>

      {activePoints.length === 0 ? (
        <div className="mt-6 flex h-44 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-subtle">
          Play a few rounds in this period to chart your trend.
        </div>
      ) : (
        <div className="relative mt-4">
          {/* Interactive status summary above chart */}
          <div className="mb-2 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs text-muted">
            {hovered ? (
              <>
                <span className="font-bold text-cream">
                  {trend.granularity === 'week' ? 'Week of ' : ''}
                  {formatShortDate(hovered.point.bucketStart)}
                  <span className="ml-2 font-normal text-subtle">
                    ({hovered.point.rounds}{' '}
                    {hovered.point.rounds === 1 ? 'round' : 'rounds'})
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span>
                    Avg: <strong className="text-cream">{formatScore(hovered.point.averageScore)}</strong>
                  </span>
                  {metric === 'score' && (
                    <span>
                      Rolling:{' '}
                      <strong className="text-lime-300">
                        {formatScore(hovered.point.rollingAverageScore)}
                      </strong>
                    </span>
                  )}
                  <span>
                    Median:{' '}
                    <strong className="text-sky-300">
                      {formatDistance(hovered.point.medianDistanceKm)}
                    </strong>
                  </span>
                </span>
              </>
            ) : (
              <span className="text-subtle">Hover or tap any point to inspect bucket details.</span>
            )}
          </div>

          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-52 w-full overflow-visible sm:h-56"
            role="img"
            aria-label={
              metric === 'score'
                ? 'Rolling average score chart over time'
                : 'Median guess distance chart over time'
            }
            onMouseLeave={() => setActiveIndex(null)}
          >
            <defs>
              <linearGradient id="tg-trend-fill-score" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c0f66b" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#c0f66b" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="tg-trend-fill-dist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#57c4e8" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#57c4e8" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines + Y-axis labels */}
            {yTicks.map((tick) => {
              const y = yFor(tick)
              return (
                <g key={tick}>
                  <line
                    x1={PAD_X}
                    x2={WIDTH - PAD_X}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="3 4"
                  />
                  <text
                    x={PAD_X - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="#948bac"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {metric === 'score'
                      ? tick === 0
                        ? '0'
                        : `${(tick / 1000).toFixed(tick % 1000 === 0 ? 0 : 1)}k`
                      : tick >= 1000
                        ? `${(tick / 1000).toFixed(1)}k`
                        : `${tick}`}
                  </text>
                </g>
              )
            })}

            {/* Area fill */}
            {areaPath && (
              <path
                d={areaPath}
                fill={
                  metric === 'score'
                    ? 'url(#tg-trend-fill-score)'
                    : 'url(#tg-trend-fill-dist)'
                }
              />
            )}

            {/* Raw bucket dashed line (score view only, when >= 2 points) */}
            {metric === 'score' && coords.length >= 2 && (
              <path
                d={rawLinePath}
                fill="none"
                stroke="rgba(189,181,216,0.35)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            )}

            {/* Main line */}
            {coords.length >= 2 && (
              <path
                d={mainLinePath}
                fill="none"
                stroke={metric === 'score' ? '#c0f66b' : '#57c4e8'}
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* X-axis labels */}
            {coords.map((c, index) => {
              if (index % labelStep !== 0 && index !== coords.length - 1) return null
              return (
                <text
                  key={c.point.bucketStart}
                  x={c.x}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  fill="#948bac"
                  fontSize="10"
                  fontWeight="600"
                >
                  {formatShortDate(c.point.bucketStart)}
                </text>
              )
            })}

            {/* Interactive data points */}
            {coords.map((c, index) => {
              const isActive = activeIndex === index
              const color = metric === 'score' ? '#c0f66b' : '#57c4e8'
              return (
                <g key={c.point.bucketStart}>
                  {isActive && (
                    <line
                      x1={c.x}
                      x2={c.x}
                      y1={PAD_TOP}
                      y2={PAD_TOP + plotH}
                      stroke="rgba(255,255,255,0.18)"
                      strokeWidth="1"
                    />
                  )}
                  <circle
                    cx={c.x}
                    cy={c.yMain}
                    r={isActive ? 6 : coords.length <= 15 ? 4 : 3}
                    fill={color}
                    stroke="#14112a"
                    strokeWidth="2"
                  />
                  {/* Generous invisible hit target */}
                  <circle
                    cx={c.x}
                    cy={c.yMain}
                    r={14}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => setActiveIndex(index)}
                  />
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </section>
  )
}
