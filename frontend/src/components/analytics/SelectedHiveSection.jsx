import { lazy, Suspense } from 'react';
import { ErrorState, LoadingState } from './StateBlocks';
import SelectedHiveMetricRow from './SelectedHiveMetricRow';

const DashboardHiveTemperatureChart = lazy(
  () => import('./DashboardHiveTemperatureChart'),
);

// Below this many readings in a 24h window we surface a calm helper line
// above the chart so the line-of-dots reads as "sparse data" instead
// of "the chart is broken".
const SPARSE_READING_THRESHOLD = 12;

/**
 * Selected-hive detail panel. Composed of two parts:
 *   1. SelectedHiveMetricRow — compact horizontal summary (Latest, Avg,
 *      Min, Max, Swing, Readings, Packet ID).
 *   2. The 24h temperature chart with a sparse-data helper line when
 *      there are very few readings in the window, and a small context
 *      line above the chart title showing which hive + yard this panel
 *      belongs to (replaces the old "selected hive header" strip that
 *      duplicated the picker selection and added a Healthy chip).
 *
 * No DashboardSection wrapper here — the parent page owns the section
 * header so the picker and this panel can share a single title.
 */
export default function SelectedHiveSection({
  selectedHive,
  selectedId,
  selectedTimeline,
  selectedAnalytics,
  globalStale = false,
}) {
  const selectedSummary = selectedAnalytics.summary ?? {};
  const selectedName =
    selectedHive?.name || (selectedId ? `Hive ${selectedId}` : 'No hive selected');
  const selectedLocationName = selectedHive?.locationName || '';

  const hasError = selectedAnalytics.error || selectedTimeline.error;
  const readingCount = Number(selectedSummary?.readingCount);
  const validReadingCount = Number.isFinite(readingCount) ? readingCount : null;
  const isSparse = validReadingCount != null && validReadingCount < SPARSE_READING_THRESHOLD;

  return (
    <section
      className="flex min-w-0 flex-col gap-3.5"
      aria-label="Selected hive detail"
    >
      <SelectedHiveMetricRow
        summary={selectedSummary}
        latestReading={selectedAnalytics.latestReading}
        hive={selectedHive}
      />

      {/*
        The chart card used to ship with `min-h-[380px]`, which left
        ~22px of dead space below the 280px chart SVG (the card is
        380px tall, the chart fills 280px of it, so 100px of
        card-internal space sits below the chart line). That dead
        space showed up in the measured DOM as a 82px gap from the
        selected hive chart SVG bottom to the Fleet Trend heading —
        far more than the dashboard rhythm wants.

        No `min-h` here: the card now sizes to its content
        (header + 280px chart + 36px padding ≈ 374px natural). If
        an empty/loading state ever needs a floor, the StateBlock
        already ships its own `min-h-[220px]`, so the card never
        collapses below a readable size.
      */}
      <div className="flex flex-col rounded-lg border border-line bg-surface-elevated p-[18px] shadow-card-sm">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <div className="min-w-0">
            {/* Small context line replaces the old full-width header
                strip. Keeps the user oriented ("this panel is for
                Hive X at Yard Y") without the redundant title + chip. */}
            {selectedHive && (
              <div
                className="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-extrabold uppercase leading-[1.2] tracking-[0.06em] text-ink-secondary"
                aria-label={`Showing ${selectedName}${selectedLocationName ? ` at ${selectedLocationName}` : ''}`}
              >
                <span className="truncate text-white">{selectedName}</span>
                {selectedLocationName && (
                  <>
                    <span className="text-ink-muted/60" aria-hidden="true">·</span>
                    <span className="truncate text-ink-muted">{selectedLocationName}</span>
                  </>
                )}
                {globalStale && (
                  <>
                    <span className="text-ink-muted/60" aria-hidden="true">·</span>
                    <span className="text-ink-muted">Stale</span>
                  </>
                )}
              </div>
            )}
            <div className="text-[14px] font-extrabold leading-[1.2] text-white">
              24-Hour Temperature Trend
            </div>
            {isSparse ? (
              <div className="mt-0.5 text-[12px] text-ink-muted">
                Only {validReadingCount} reading{validReadingCount === 1 ? '' : 's'} in
                this 24h window · data may be stale
              </div>
            ) : (
              <div className="mt-0.5 text-[12px] text-ink-muted">
                Internal vs outside temperature, 10-minute buckets
              </div>
            )}
          </div>
          {/* Inline chart legend so it lives in the header instead of
              floating at the bottom of the chart card. */}
          <div className="flex shrink-0 items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.06em] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-1.5 w-3 rounded-full bg-amber"
              />
              Internal
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-1.5 w-3 rounded-full"
                style={{ backgroundColor: '#22D3EE' }}
              />
              Outside
            </span>
          </div>
        </div>
        {hasError ? (
          <ErrorState
            message={selectedAnalytics.error || selectedTimeline.error}
          />
        ) : (
          <Suspense fallback={<LoadingState label="Loading chart renderer…" />}>
            <DashboardHiveTemperatureChart
              timeline={selectedTimeline.data}
              hiveName={selectedName}
              loading={selectedTimeline.loading}
            />
          </Suspense>
        )}
      </div>
    </section>
  );
}
