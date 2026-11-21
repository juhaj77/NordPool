import {
    ComposedChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell,
} from 'recharts';
import { usePrices } from './PriceContext';
import DraggableThreshold from './DraggableThreshold';
import StatTile from './StatTile';
import { useChartTheme, slotRangeLabel, priceStats } from './theme';

const CurrentDay = () => {
    const {
        prices,
        loading,
        error,
        nowKey,
        currentPrice,
        alertEnabled,
        alertThreshold,
        isOverThreshold,
        googleAuthed,
        googleError,
        saving,
        savedCount,
        setAlertThreshold,
        enableAlert,
        disableAlert,
        saveUpcomingAlertsToCalendar,
    } = usePrices();
    const { C, gridStroke, axisStroke, axisTick, tooltipCursor, tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } = useChartTheme();

    const calculateCountdown = () => {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        const nextQuarterMinute = (Math.floor(minutes / 15) + 1) * 15;
        let diffMinutes = nextQuarterMinute - minutes - 1;
        let diffSeconds = 60 - seconds;

        if (diffSeconds === 60) {
            diffSeconds = 0;
            diffMinutes += 1;
        }

        return `${String(diffMinutes).padStart(2, '0')}:${String(diffSeconds).padStart(2, '0')}`;
    };

    if (error) return <div className="error-message">Virhe: {error}</div>;

    const stats = priceStats(prices);
    const maxPrice = stats ? stats.max.price : 0;
    // Kiinteä Y-akselin yläraja pitää viivan ja pylväiden skaalan samana
    const yMax = Math.max(1, Math.ceil(maxPrice * 1.1));

    const barColor = (entry) => {
        if (entry.time === nowKey) return C.red;
        if (alertEnabled && entry.price > alertThreshold) return C.amber;
        return C.blue;
    };

    const adjustThreshold = (delta) => {
        setAlertThreshold(Math.max(0, Math.min(yMax, Math.round((alertThreshold + delta) * 10) / 10)));
    };

    return (
        <div className="view">
            <div className="stat-row">
                <StatTile
                    label="Nyt"
                    tone="red"
                    value={currentPrice != null ? currentPrice.toFixed(2) : null}
                    unit="c/kWh"
                    sub={currentPrice != null ? `vaihtuu ${calculateCountdown()}` : 'ei dataa'}
                />
                <StatTile
                    label="Kallein"
                    value={stats ? stats.max.price.toFixed(2) : null}
                    unit="c/kWh"
                    sub={stats ? `klo ${stats.max.time}` : null}
                />
                <StatTile
                    label="Halvin"
                    value={stats ? stats.min.price.toFixed(2) : null}
                    unit="c/kWh"
                    sub={stats ? `klo ${stats.min.time}` : null}
                />
                <StatTile
                    label="Keskiarvo"
                    value={stats ? stats.avg.toFixed(2) : null}
                    unit="c/kWh"
                    sub={stats ? `${stats.count} varttia` : null}
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
                    <span className="alert-label">Hintahälytys</span>

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
                                : 'Ei tulevia ylityksiä tänään'}
                        </span>
                    )}

                    {googleError && (
                        <span className="alert-error">⚠ {googleError}</span>
                    )}

                    {alertEnabled && !googleError && (
                        isOverThreshold
                            ? <span className="alert-badge over">⚠ Hinta yli rajan</span>
                            : <span className="alert-hint">vedä keltaista viivaa säätääksesi rajaa</span>
                    )}
                </div>

                {alertEnabled && googleAuthed && (
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={saveUpcomingAlertsToCalendar}
                        disabled={saving}
                    >
                        {saving ? 'Tallennetaan…' : 'Tallenna hälytykset kalenteriin'}
                    </button>
                )}
            </div>

            <div className="panel chart-panel">
                <div className="panel-title">
                    Sähkön hinta tänään
                    <span className="panel-sub">15 min vartit · sis. ALV 25,5 % · c/kWh</span>
                </div>
                <div className="chart-container">
                    {!loading && prices.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
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
                                <ReferenceLine
                                    x={nowKey}
                                    stroke={C.red}
                                    strokeWidth={2}
                                    label={{ fontSize: 10, value: 'NYT', fill: C.red, position: 'top', fontWeight: 700, offset: 8 }}
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
                                        over={isOverThreshold}
                                        onChange={setAlertThreshold}
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="loading">Ladataan hintoja…</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CurrentDay;
