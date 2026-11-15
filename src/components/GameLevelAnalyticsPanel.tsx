import { useEffect, useMemo, useState } from 'react';
import {
  buildGameAnalyticsDrilldown,
  buildGameAnalyticsSummary,
  gameAnalyticsOpeningRows,
  type GameAnalyticsDrilldownRequest,
  type GameAnalyticsDrilldownResult,
  type GameAnalyticsMetricKind,
  type GameAnalyticsSummary,
  type GameAnalyticsWindow,
  type GamePhase,
  type OpeningPerformanceRow,
  type WindowMetric,
} from '../lib/gameAnalytics';
import type { GameLibraryEntry, GameLibraryMemory } from '../lib/gameLibrary';

interface GameLevelAnalyticsPanelProps {
  memory: GameLibraryMemory;
  onOpenGame(entry: GameLibraryEntry): void;
  onOpenMove(entry: GameLibraryEntry, ply: number): void;
}

type ComparisonMode = 'window' | 'color' | 'opening' | 'phase';
type EvidenceView = 'moves' | 'games';

function formatCpl(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)} cp`;
}

function formatPerGame(value: number | null): string {
  return value === null ? '—' : value.toFixed(2);
}

function phaseLabel(phase: GamePhase): string {
  if (phase === 'opening') return 'Opening';
  if (phase === 'middlegame') return 'Middlegame';
  return 'Endgame';
}

function trendLabel(summary: GameAnalyticsSummary): string {
  const cpl = summary.overallTrend.cplDelta;
  const blunders = summary.overallTrend.blunderDelta;
  if (cpl === null || blunders === null) return 'Not enough older reviewed games yet to compare this window with the previous one.';
  const cplText = cpl <= -8
    ? `CPL improved by ${Math.round(Math.abs(cpl))}`
    : cpl >= 8
      ? `CPL worsened by ${Math.round(cpl)}`
      : 'CPL is stable';
  const blunderText = blunders <= -0.10
    ? `blunders/game down ${Math.abs(blunders).toFixed(2)}`
    : blunders >= 0.10
      ? `blunders/game up ${blunders.toFixed(2)}`
      : 'blunders/game stable';
  return `Versus the previous ${summary.windowSize} reviewed games: ${cplText}; ${blunderText}.`;
}

function windowLabel(window: GameAnalyticsWindow, size: number): string {
  if (window === 'previous') return `Previous ${size}`;
  if (window === 'all') return 'All reviewed';
  return `Last ${size}`;
}

function drilldownTitle(request: GameAnalyticsDrilldownRequest, size: number): string {
  const subject = request.label ?? request.openingKey ?? (request.phase ? phaseLabel(request.phase) : request.color ? (request.color === 'w' ? 'White' : 'Black') : 'All reviewed games');
  const metric = request.metric === 'cpl' ? 'CPL evidence'
    : request.metric === 'blunders' ? 'Blunders'
      : request.metric === 'issues' ? 'Issues'
        : request.metric === 'moves' ? 'Reviewed moves'
          : 'Games';
  return `${subject} · ${metric} · ${windowLabel(request.window, size)}`;
}

function MetricButton({
  label,
  value,
  detail,
  onClick,
}: {
  label: string;
  value: string | number;
  detail?: string;
  onClick(): void;
}) {
  return (
    <button type="button" className="analytics-metric-button" onClick={onClick} title={`Show exact games and moves for ${label}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </button>
  );
}

function metricRequest(
  metric: GameAnalyticsMetricKind,
  label: string,
  extra: Partial<GameAnalyticsDrilldownRequest> = {},
): GameAnalyticsDrilldownRequest {
  return { window: 'current', metric, label, ...extra };
}

function metricSummary(result: GameAnalyticsDrilldownResult): WindowMetric {
  return {
    games: result.games,
    reviewedMoves: result.reviewedMoves,
    avgCpl: result.avgCpl,
    blundersPerGame: result.blundersPerGame,
    issuesPerGame: result.issuesPerGame,
  };
}

function comparisonGap(a: WindowMetric | null, b: WindowMetric | null): string {
  if (!a || !b || a.avgCpl === null || b.avgCpl === null) return 'Not enough comparable reviewed moves.';
  const delta = b.avgCpl - a.avgCpl;
  const label = Math.abs(delta) < 1 ? 'essentially equal CPL' : `${Math.abs(Math.round(delta))} cp ${delta > 0 ? 'higher' : 'lower'} on the right`;
  const blunderGap = a.blundersPerGame !== null && b.blundersPerGame !== null
    ? ` · blunder gap ${(b.blundersPerGame - a.blundersPerGame).toFixed(2)}/game`
    : '';
  return `${label}${blunderGap}`;
}

function ComparisonCard({
  title,
  subtitle,
  metric,
  onPick,
}: {
  title: string;
  subtitle: string;
  metric: WindowMetric;
  onPick(metric: GameAnalyticsMetricKind): void;
}) {
  return (
    <article className="analytics-comparison-card">
      <div className="analytics-comparison-heading">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="analytics-comparison-metrics">
        <MetricButton label="Games" value={metric.games} onClick={() => onPick('games')} />
        <MetricButton label="Moves" value={metric.reviewedMoves} onClick={() => onPick('moves')} />
        <MetricButton label="Avg CPL" value={formatCpl(metric.avgCpl)} onClick={() => onPick('cpl')} />
        <MetricButton label="Blunders/game" value={formatPerGame(metric.blundersPerGame)} onClick={() => onPick('blunders')} />
      </div>
    </article>
  );
}

export function GameLevelAnalyticsPanel({ memory, onOpenGame, onOpenMove }: GameLevelAnalyticsPanelProps) {
  const [windowSize, setWindowSize] = useState<10 | 20 | 50>(20);
  const [drillRequest, setDrillRequest] = useState<GameAnalyticsDrilldownRequest | null>(null);
  const [evidenceView, setEvidenceView] = useState<EvidenceView>('moves');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('window');
  const [openingA, setOpeningA] = useState('');
  const [openingB, setOpeningB] = useState('');

  const summary = useMemo(() => buildGameAnalyticsSummary(memory, windowSize), [memory, windowSize]);
  const openingRows = useMemo(() => gameAnalyticsOpeningRows(memory, windowSize, 'current'), [memory, windowSize]);
  const drilldown = useMemo(
    () => drillRequest ? buildGameAnalyticsDrilldown(memory, windowSize, drillRequest) : null,
    [memory, windowSize, drillRequest],
  );

  useEffect(() => {
    setDrillRequest(null);
    setEvidenceView('moves');
  }, [windowSize]);

  useEffect(() => {
    if (!openingRows.length) {
      setOpeningA('');
      setOpeningB('');
      return;
    }
    if (!openingRows.some((row) => row.key === openingA)) setOpeningA(openingRows[0].key);
    if (!openingRows.some((row) => row.key === openingB) || openingB === openingA) {
      setOpeningB(openingRows.find((row) => row.key !== openingA)?.key ?? openingRows[0].key);
    }
  }, [openingRows, openingA, openingB]);

  function openDrill(request: GameAnalyticsDrilldownRequest, view: EvidenceView = 'moves'): void {
    setDrillRequest(request);
    setEvidenceView(view);
  }

  function openingDrill(row: OpeningPerformanceRow, metric: GameAnalyticsMetricKind): GameAnalyticsDrilldownRequest {
    return metricRequest(metric, row.label, { openingKey: row.key });
  }

  const openingAResult = openingA
    ? buildGameAnalyticsDrilldown(memory, windowSize, { window: 'current', metric: 'cpl', openingKey: openingA, label: openingRows.find((row) => row.key === openingA)?.label })
    : null;
  const openingBResult = openingB
    ? buildGameAnalyticsDrilldown(memory, windowSize, { window: 'current', metric: 'cpl', openingKey: openingB, label: openingRows.find((row) => row.key === openingB)?.label })
    : null;

  return (
    <section className="panel game-level-analytics-panel" id="coach-game-analytics">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Diagnostic game analytics</span>
          <h2>Analytics → games drill-down</h2>
        </div>
        <button
          type="button"
          className="game-analytics-total clickable"
          onClick={() => openDrill({ window: 'all', metric: 'games', label: 'All reviewed games' }, 'games')}
        >
          {summary.availableReviewedGames} reviewed games
        </button>
      </div>

      <div className="game-analytics-window-picker" aria-label="Analytics window size">
        {([10, 20, 50] as const).map((size) => (
          <button
            key={size}
            type="button"
            className={windowSize === size ? 'active' : ''}
            aria-pressed={windowSize === size}
            onClick={() => setWindowSize(size)}
          >
            Last {size}
          </button>
        ))}
      </div>

      {summary.current.games === 0 ? (
        <div className="game-analytics-empty">
          <strong>No reviewed games yet.</strong>
          <p>Review some played or imported games first. The persistent library will then aggregate CPL, blunders, openings and phase trends automatically.</p>
        </div>
      ) : (
        <>
          <div className="game-analytics-overview clickable-metrics">
            <MetricButton label="Reviewed games" value={summary.current.games} onClick={() => openDrill(metricRequest('games', `Last ${windowSize}`), 'games')} />
            <MetricButton label="Reviewed moves" value={summary.current.reviewedMoves} onClick={() => openDrill(metricRequest('moves', `Last ${windowSize}`))} />
            <MetricButton label="Avg CPL" value={formatCpl(summary.current.avgCpl)} onClick={() => openDrill(metricRequest('cpl', `Last ${windowSize}`))} />
            <MetricButton label="Blunders/game" value={formatPerGame(summary.current.blundersPerGame)} onClick={() => openDrill(metricRequest('blunders', `Last ${windowSize} blunders`))} />
            <MetricButton label="Issues/game" value={formatPerGame(summary.current.issuesPerGame)} onClick={() => openDrill(metricRequest('issues', `Last ${windowSize} issues`))} />
          </div>

          <button type="button" className="game-analytics-trend-summary clickable" onClick={() => setComparisonMode('window')}>
            {trendLabel(summary)} <b>Open comparison explorer →</b>
          </button>

          <div className="game-analytics-section">
            <div className="subsection-heading">
              <h3>White vs Black</h3>
              <span>Every number opens its exact contributing moves</span>
            </div>
            <div className="game-analytics-color-grid">
              {summary.current.gamesByColor.map((row) => {
                const label = row.color === 'w' ? 'As White' : 'As Black';
                const extra = { color: row.color, label } as const;
                return (
                  <article key={row.color} className="game-analytics-card">
                    <div className="game-analytics-card-heading">
                      <strong>{label}</strong>
                      <button type="button" onClick={() => openDrill(metricRequest('games', label, extra), 'games')}>{row.games} games</button>
                    </div>
                    <div className="game-analytics-card-metrics clickable-metrics">
                      <MetricButton label="Moves" value={row.reviewedMoves} onClick={() => openDrill(metricRequest('moves', label, extra))} />
                      <MetricButton label="Avg CPL" value={formatCpl(row.avgCpl)} onClick={() => openDrill(metricRequest('cpl', label, extra))} />
                      <MetricButton label="Blunders/game" value={formatPerGame(row.blundersPerGame)} onClick={() => openDrill(metricRequest('blunders', `${label} blunders`, extra))} />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="game-analytics-section">
            <div className="subsection-heading">
              <h3>Opening / Middlegame / Endgame</h3>
              <span>Click “Middlegame · 91 cp” to see the exact games and moves</span>
            </div>
            <div className="game-analytics-phase-grid">
              {summary.current.phases.map((phase) => {
                const label = phaseLabel(phase.phase);
                const extra = { phase: phase.phase, label } as const;
                return (
                  <article key={phase.phase} className={`game-analytics-card phase-${phase.phase}`}>
                    <div className="game-analytics-card-heading">
                      <strong>{label}</strong>
                      <button type="button" onClick={() => openDrill(metricRequest('games', label, extra), 'games')}>{phase.games} games</button>
                    </div>
                    <div className="game-analytics-card-metrics clickable-metrics">
                      <MetricButton label="Moves" value={phase.reviewedMoves} onClick={() => openDrill(metricRequest('moves', label, extra))} />
                      <MetricButton label="Avg CPL" value={formatCpl(phase.avgCpl)} onClick={() => openDrill(metricRequest('cpl', `${label} CPL`, extra))} />
                      <MetricButton label="Blunders/game" value={formatPerGame(phase.blundersPerGame)} onClick={() => openDrill(metricRequest('blunders', `${label} blunders`, extra))} />
                    </div>
                    <div className="phase-strength-row">
                      <span className={`phase-strength strength-${phase.strength.toLowerCase().replace(/\s+/g, '-')}`}>{phase.strength}</span>
                      <button type="button" className={`phase-trend trend-${phase.trend} clickable`} onClick={() => openDrill(metricRequest('cpl', `${label} trend evidence`, extra))}>
                        {phase.trend === 'improving' && phase.deltaCpl !== null && `Improving · ${Math.round(Math.abs(phase.deltaCpl))} cp lower`}
                        {phase.trend === 'declining' && phase.deltaCpl !== null && `Declining · ${Math.round(phase.deltaCpl)} cp higher`}
                        {phase.trend === 'stable' && 'Stable'}
                        {phase.trend === 'n/a' && 'No prior window'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="game-analytics-section">
            <div className="subsection-heading">
              <h3>Opening performance</h3>
              <span>Most frequent openings in this window</span>
            </div>
            {summary.current.openings.length === 0 ? (
              <p className="game-analytics-empty-note">No classified openings yet in the selected window.</p>
            ) : (
              <div className="game-analytics-opening-list">
                {summary.current.openings.map((opening) => (
                  <article key={opening.key} className="game-analytics-opening-card">
                    <div>
                      <span>{opening.eco ?? '—'}</span>
                      <strong>{opening.label}</strong>
                    </div>
                    <div className="game-analytics-opening-metrics clickable-metrics">
                      <MetricButton label="Games" value={opening.games} onClick={() => openDrill(openingDrill(opening, 'games'), 'games')} />
                      <MetricButton label="Moves" value={opening.reviewedMoves} onClick={() => openDrill(openingDrill(opening, 'moves'))} />
                      <MetricButton label="Avg CPL" value={formatCpl(opening.avgCpl)} onClick={() => openDrill(openingDrill(opening, 'cpl'))} />
                      <MetricButton label="Blunders/game" value={formatPerGame(opening.blundersPerGame)} onClick={() => openDrill(openingDrill(opening, 'blunders'))} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="analytics-comparison-explorer">
            <div className="subsection-heading">
              <h3>Comparison explorer</h3>
              <span>Diagnose gaps, then click a metric to see evidence</span>
            </div>
            <div className="analytics-comparison-tabs">
              {([
                ['window', `Last ${windowSize} vs previous ${windowSize}`],
                ['color', 'White vs Black'],
                ['opening', 'Opening vs opening'],
                ['phase', 'Opening / Middlegame / Endgame'],
              ] as Array<[ComparisonMode, string]>).map(([mode, label]) => (
                <button key={mode} type="button" className={comparisonMode === mode ? 'active' : ''} onClick={() => setComparisonMode(mode)}>{label}</button>
              ))}
            </div>

            {comparisonMode === 'window' && (
              <div className="analytics-comparison-content">
                <div className="analytics-comparison-grid">
                  {summary.previous ? (
                    <ComparisonCard
                      title={`Previous ${windowSize}`}
                      subtitle={`${summary.previous.games} reviewed games`}
                      metric={summary.previous}
                      onPick={(metric) => openDrill({ window: 'previous', metric, label: `Previous ${windowSize}` }, metric === 'games' ? 'games' : 'moves')}
                    />
                  ) : <div className="game-analytics-empty-note">No previous comparison window yet.</div>}
                  <ComparisonCard
                    title={`Last ${windowSize}`}
                    subtitle={`${summary.current.games} reviewed games`}
                    metric={summary.current}
                    onPick={(metric) => openDrill({ window: 'current', metric, label: `Last ${windowSize}` }, metric === 'games' ? 'games' : 'moves')}
                  />
                </div>
                <p>{comparisonGap(summary.previous, summary.current)}</p>
              </div>
            )}

            {comparisonMode === 'color' && (
              <div className="analytics-comparison-content">
                <div className="analytics-comparison-grid">
                  {summary.current.gamesByColor.map((row) => {
                    const title = row.color === 'w' ? 'White' : 'Black';
                    return <ComparisonCard key={row.color} title={title} subtitle={`${row.games} games`} metric={row} onPick={(metric) => openDrill({ window: 'current', metric, color: row.color, label: title }, metric === 'games' ? 'games' : 'moves')} />;
                  })}
                </div>
                <p>{comparisonGap(summary.current.gamesByColor[0] ?? null, summary.current.gamesByColor[1] ?? null)}</p>
              </div>
            )}

            {comparisonMode === 'phase' && (
              <div className="analytics-comparison-content">
                <div className="analytics-comparison-grid three">
                  {summary.current.phases.map((row) => {
                    const title = phaseLabel(row.phase);
                    return <ComparisonCard key={row.phase} title={title} subtitle={`${row.games} games`} metric={row} onPick={(metric) => openDrill({ window: 'current', metric, phase: row.phase, label: title }, metric === 'games' ? 'games' : 'moves')} />;
                  })}
                </div>
              </div>
            )}

            {comparisonMode === 'opening' && (
              <div className="analytics-comparison-content">
                {openingRows.length < 2 ? (
                  <p className="game-analytics-empty-note">At least two classified openings are needed for an opening-vs-opening comparison.</p>
                ) : (
                  <>
                    <div className="analytics-opening-compare-selectors">
                      <label>Opening A<select value={openingA} onChange={(event) => setOpeningA(event.target.value)}>{openingRows.map((row) => <option key={row.key} value={row.key}>{row.eco ? `${row.eco} · ` : ''}{row.label}</option>)}</select></label>
                      <span>vs</span>
                      <label>Opening B<select value={openingB} onChange={(event) => setOpeningB(event.target.value)}>{openingRows.map((row) => <option key={row.key} value={row.key}>{row.eco ? `${row.eco} · ` : ''}{row.label}</option>)}</select></label>
                    </div>
                    <div className="analytics-comparison-grid">
                      {openingAResult && <ComparisonCard title={openingRows.find((row) => row.key === openingA)?.label ?? 'Opening A'} subtitle={openingRows.find((row) => row.key === openingA)?.eco ?? '—'} metric={metricSummary(openingAResult)} onPick={(metric) => openDrill({ window: 'current', metric, openingKey: openingA, label: openingRows.find((row) => row.key === openingA)?.label }, metric === 'games' ? 'games' : 'moves')} />}
                      {openingBResult && <ComparisonCard title={openingRows.find((row) => row.key === openingB)?.label ?? 'Opening B'} subtitle={openingRows.find((row) => row.key === openingB)?.eco ?? '—'} metric={metricSummary(openingBResult)} onPick={(metric) => openDrill({ window: 'current', metric, openingKey: openingB, label: openingRows.find((row) => row.key === openingB)?.label }, metric === 'games' ? 'games' : 'moves')} />}
                    </div>
                    <p>{comparisonGap(openingAResult ? metricSummary(openingAResult) : null, openingBResult ? metricSummary(openingBResult) : null)}</p>
                  </>
                )}
              </div>
            )}
          </div>

          {drilldown && drillRequest && (
            <div className="analytics-drilldown" id="analytics-drilldown-evidence">
              <div className="analytics-drilldown-heading">
                <div>
                  <span>Exact evidence</span>
                  <strong>{drilldownTitle(drillRequest, windowSize)}</strong>
                  <small>{drilldown.reviewedMoves} matching move{drilldown.reviewedMoves === 1 ? '' : 's'} across {drilldown.games} game{drilldown.games === 1 ? '' : 's'} · avg {formatCpl(drilldown.avgCpl)}</small>
                </div>
                <button type="button" onClick={() => setDrillRequest(null)}>Close</button>
              </div>

              <div className="analytics-evidence-tabs">
                <button type="button" className={evidenceView === 'moves' ? 'active' : ''} onClick={() => setEvidenceView('moves')}>Exact moves · {drilldown.movesList.length}</button>
                <button type="button" className={evidenceView === 'games' ? 'active' : ''} onClick={() => setEvidenceView('games')}>
                  {drillRequest.metric === 'blunders' ? 'Show games containing these blunders' : `Games containing these moves · ${drilldown.gamesList.length}`}
                </button>
              </div>

              {evidenceView === 'moves' ? (
                <div className="analytics-evidence-list moves">
                  {drilldown.movesList.length === 0 ? <p>No matching reviewed moves.</p> : drilldown.movesList.map((move) => {
                    const entry = memory.entries.find((item) => item.id === move.gameId);
                    if (!entry) return null;
                    const moveNumber = Math.ceil(move.ply / 2);
                    const prefix = move.ply % 2 === 1 ? `${moveNumber}.` : `${moveNumber}...`;
                    return (
                      <article key={`${move.gameId}:${move.ply}`} className="analytics-evidence-move">
                        <div>
                          <span>{entry.white} – {entry.black} · {entry.result}</span>
                          <strong>{prefix}{move.san} · {move.verdict} · {Math.round(move.cpl)} cp</strong>
                          <small>{phaseLabel(move.phase)} · {move.openingEco ?? '—'} {move.openingLabel}</small>
                        </div>
                        <button type="button" className="primary-button" onClick={() => onOpenMove(entry, move.ply)}>Open move</button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="analytics-evidence-list games">
                  {drilldown.gamesList.length === 0 ? <p>No matching games.</p> : drilldown.gamesList.map((row) => (
                    <article key={row.entry.id} className="analytics-evidence-game">
                      <div>
                        <span>{row.entry.date ?? new Date(row.entry.createdAt).toLocaleDateString()} · {row.entry.opening?.eco ?? '—'}</span>
                        <strong>{row.entry.white} – {row.entry.black} · {row.entry.result}</strong>
                        <small>{row.matchingMoves} matching moves · avg {formatCpl(row.avgCpl)} · {row.blunders} blunders · {row.issues} issues</small>
                      </div>
                      <button type="button" onClick={() => onOpenGame(row.entry)}>Open game</button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="game-analytics-empty-note">Pinned games remain part of your statistics. Model games and archived games are excluded so reference material and hidden/test games do not distort personal performance trends.</p>
        </>
      )}
    </section>
  );
}
