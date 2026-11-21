import {
    ComposedChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { usePrices } from './PriceContext';
import DraggableThreshold from './DraggableThreshold';
import StatTile from './StatTile';
import { useChartTheme, slotRangeLabel, priceStats } from './theme';

const Tomorrow = () => {
    const {
        tomorrowPrices: prices,
        tomorrowLoading: loading,
        tomorrowAlertEnabled: alertEnabled,
        tomorrowAlertThreshold: alertThreshold,
        googleAuthed,
        googleError,
        tomorrowSaving: saving,
        tomorrowSavedCount: savedCount,
        setTomorrowAlertThreshold: setAlertThreshold,
        enableTomorrowAlert: enableAlert,
        disableTomorrowAlert: disableAlert,
        saveTomorrowAlertsToCalendar,
    } = usePrices();
    const { C, gridStroke, axisStroke, axisTick, tooltipCursor, tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } = useChartTheme();

    const stats = priceStats(prices);
    const maxPrice = stats ? stats.max.price : 0;
    // Kiinteä Y-akselin yläraja pitää viivan ja pylväiden skaalan samana
    const yMax = Math.max(1, Math.ceil(maxPrice * 1.1));

    const barColor = (entry) => {
        if (alertEnabled && entry.price > alertThreshold) return C.amber;
        return C.blue;
    };

    const adjustThreshold = (delta) => {
        setAlertThreshold(Math.max(0, Math.min(yMax, Math.round((alertThreshold + delta) * 10) / 10)));
    };

    const hasData = !loading && prices.length > 0;
    const overCount = alertEnabled ? prices.filter(p => p.price > alertThreshold).length : null;

    return (
        <div className="view">
            <div className="stat-row">
                <StatTile
                    label="Kallein"
                    value={stats ? stats.max.price.toFixed(2) : null}
                    unit="c/kWh"
                    sub={stats ? `klo ${stats.max.time}` : 'ei vielä julkaistu'}
                />
                <StatTile
                    label="Halvin"
                    value={stats ? stats.min.price.toFixed(2) : null}
                    unit="c/kWh"
                    sub={stats ? `klo ${stats.min.time}` : 'ei vielä julkaistu'}
                />
                <StatTile
                    label="Keskiarvo"
                    value={stats ? stats.avg.toFixed(2) : null}
                    unit="c/kWh"
                    sub={stats ? `${stats.count} varttia` : 'ei vielä julkaistu'}
                />
                <StatTile
                    label="Yli rajan"
                    tone={overCount ? 'amber' : undefined}
                    value={stats && overCount != null ? String(overCount) : null}
                    unit="varttia"
                    sub={alertEnabled ? `raja ${alertThreshold.toFixed(1)} c/kWh` : 'hälytys pois päältä'}
                />
            </div>

            <div className="panel toolbar">
                <div className="alert-controls">
                    <label className="switch">
                        <input
                            type="checkbox"
                            checked={alertEnabled}
                            onChange={(e) => (e.target.checked ? enableAlert() : disableAlert())}
                        />
                        <span className="slider" />
                    </label>
                    <span className="alert-label">Ennakkohälytys</span>

                    {alertEnabled && googleAuthed && (
                        <span className="pill pill-green">Google Kalenteri</span>
                    )}

                    {alertEnabled && (
                        <span className="alert-value">
                            Raja <strong>{alertThreshold.toFixed(1)} c/kWh</strong>
                            <button type="button" onClick={() => adjustThreshold(-0.5)} aria-label="Vähennä">–</button>
                            <button type="button" onClick={() => adjustThreshold(0.5)} aria-label="Lisää">+</button>
                        </span>
                    )}

                    {savedCount !== null && !saving && (
                        <span className={savedCount > 0 ? 'pill pill-green' : 'alert-hint'}>
                            {savedCount > 0
                                ? `✓ ${savedCount} hälytystä tallennettu`
                                : 'Ei ylityksiä huomiselle'}
                        </span>
                    )}

                    {googleError && (
                        <span className="alert-error">⚠ {googleError}</span>
                    )}

                    {alertEnabled && !googleError && (
                        hasData
                            ? <span className="alert-hint">vedä keltaista viivaa säätääksesi rajaa</span>
                            : <span className="alert-hint">huomisen hinnat julkaistaan arviolta klo 14:15</span>
                    )}
                </div>

                {alertEnabled && googleAuthed && hasData && (
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={saveTomorrowAlertsToCalendar}
                        disabled={saving}
                    >
                        {saving ? 'Tallennetaan…' : 'Tallenna hälytykset kalenteriin'}
                    </button>
                )}
            </div>

            <div className="panel chart-panel">
                <div className="panel-title">
                    Sähkön hinta huomenna
                    <span className="panel-sub">15 min vartit · sis. ALV 25,5 % · c/kWh</span>
                </div>
                <div className="chart-container">
                    {loading ? (
                        <div className="loading">Ladataan hintoja…</div>
                    ) : hasData ? (
                        <ResponsiveContainer width="100%" height="100%" debounce={50}>
                            <ComposedChart
                                data={prices}
                                barCategoryGap={'12%'}
                                margin={{ left: -10, right: 0, top: 20 }}
                            >
                                <CartesianGrid vertical={false} stroke={gridStroke} />
                                <XAxis
                                    dataKey="time"
                                    interval={3}
                                    scale="band"
                                    tickPlacement="on"
                                    padding={{ left: 0, right: 0 }}
                                    tickFormatter={(time) => parseInt(time.split(':')[0], 10).toString()}
                                    tick={axisTick}
                                    stroke={axisStroke}
                                    tickLine={false}
                                />
                                <YAxis
                                    domain={[0, yMax]}
                                    allowDataOverflow={true}
                                    tickCount={8}
                                    tick={axisTick}
                                    tickFormatter={(val) => `${val.toFixed(0)}`}
                                    stroke={axisStroke}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={tooltipCursor}
                                    labelFormatter={slotRangeLabel}
                                    contentStyle={tooltipContentStyle}
                                    labelStyle={tooltipLabelStyle}
                                    itemStyle={tooltipItemStyle}
                                    formatter={(value) => [`${value.toFixed(2)} c/kWh`, 'Hinta']}
                                />
                                <Bar dataKey="price" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                                    {prices.map((entry) => (
                                        <Cell
                                            key={`cell-${entry.time}`}
                                            fill={barColor(entry)}
                                        />
                                    ))}
                                </Bar>
                                {alertEnabled && (
                                    <DraggableThreshold
                                        threshold={alertThreshold}
                                        yMax={yMax}
                                        over={false}
                                        onChange={setAlertThreshold}
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="loading">
                            Huomisen hinnat julkaistaan arviolta klo 14:15.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Tomorrow;
