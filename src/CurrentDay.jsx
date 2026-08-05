import { useRef } from 'react';
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
    usePlotArea,
} from 'recharts';
import { usePrices } from './PriceContext';

// Vedettävä vaakaviiva maksimihinnan valintaan. Renderöidään ComposedChartin
// lapsena, jolloin usePlotArea() antaa piirtoalueen pikselikoordinaatit.
const DraggableThreshold = ({ threshold, yMax, onChange, over }) => {
    const plot = usePlotArea();
    const draggingRef = useRef(false);
    if (!plot) return null;

    const { x, y, width, height } = plot;
    const right = x + width;
    const clamp = (v) => Math.max(0, Math.min(yMax, v));
    const py = y + height * (1 - clamp(threshold) / yMax);

    const startDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const svg = e.target.ownerSVGElement;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        draggingRef.current = true;

        const onMove = (ev) => {
            if (!draggingRef.current) return;
            const svgY = ev.clientY - rect.top;
            const value = clamp(yMax * (1 - (svgY - y) / height));
            onChange(Math.round(value * 10) / 10);
        };
        const onUp = () => {
            draggingRef.current = false;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    const color = over ? '#ef4444' : '#f59e0b';

    return (
        <g>
            <line
                x1={x}
                x2={right}
                y1={py}
                y2={py}
                stroke={color}
                strokeWidth={2}
                strokeDasharray="6 5"
                pointerEvents="none"
            />
            {/* Leveä läpinäkyvä tartunta-alue helpottaa vetämistä */}
            <rect
                x={x}
                y={py - 12}
                width={width}
                height={24}
                fill="transparent"
                style={{ cursor: 'ns-resize' }}
                onPointerDown={startDrag}
            />
            {/* Kahva, joka näyttää valitun rajahinnan */}
            <g style={{ cursor: 'ns-resize' }} onPointerDown={startDrag}>
                <rect x={right - 78} y={py - 12} width={74} height={24} rx={12} fill={color} />
                <text x={right - 41} y={py + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#ffffff">
                    {threshold.toFixed(1)} c
                </text>
            </g>
        </g>
    );
};

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

    const maxPrice = prices.length > 0 ? Math.max(...prices.map(p => p.price)) : 0;
    // Kiinteä Y-akselin yläraja pitää viivan ja pylväiden skaalan samana
    const yMax = Math.max(1, Math.ceil(maxPrice * 1.1));

    const barColor = (entry) => {
        if (entry.time === nowKey) return '#ef4444';
        if (alertEnabled && entry.price > alertThreshold) return '#f59e0b';
        return '#3365ba';
    };

    const adjustThreshold = (delta) => {
        setAlertThreshold(Math.max(0, Math.min(yMax, Math.round((alertThreshold + delta) * 10) / 10)));
    };

    return (
        <div className="card">
            <div className="header">
                <h1 className="title">
                    <span>⚡ Sähkön hinta tänään</span>
                    <span className="current-price">
                        NYT: {currentPrice != null ? (
                        <>
                            <span style={{ color: 'black' }}>{currentPrice.toFixed(2)}</span> c/kWh
                            (<span style={{ color: 'black' }}>{calculateCountdown()}</span>)
                        </>
                    ) : '--'}
                    </span>
                    <span className="max-price">
                        KALLEIN: {maxPrice ? `${maxPrice.toFixed(2)} c/kWh` : '--'}
                    </span>
                </h1>

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
                        <span className="alert-google-badge">📅 Google Kalenteri</span>
                    )}

                    {alertEnabled && (
                        <span className="alert-value">
                            Raja: <strong>{alertThreshold.toFixed(1)} c/kWh</strong>
                            <button type="button" onClick={() => adjustThreshold(-0.5)} aria-label="Vähennä">–</button>
                            <button type="button" onClick={() => adjustThreshold(0.5)} aria-label="Lisää">+</button>
                        </span>
                    )}

                    {alertEnabled && googleAuthed && (
                        <button
                            type="button"
                            className="save-offline-btn"
                            onClick={saveUpcomingAlertsToCalendar}
                            disabled={saving}
                        >
                            {saving ? 'Tallennetaan...' : '📅 Tallenna hälytykset kalenteriin'}
                        </button>
                    )}

                    {savedCount !== null && !saving && (
                        <span className={savedCount > 0 ? 'alert-google-badge' : 'alert-hint'}>
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
                            ? <span className="alert-badge over">⚠ Hinta yli rajan!</span>
                            : <span className="alert-hint">Vedä keltaista viivaa säätääksesi rajaa</span>
                    )}
                </div>
            </div>

            <div className="chart-container">
                {!loading && prices.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={prices}
                            barCategoryGap={'3%'}
                            margin={{ left: 0, right: 0, top: 20 }}
                        >
                            <CartesianGrid
                                strokeDasharray="0"
                                vertical={true}
                                horizontal={true}
                                stroke="rgba(0,0,0,0.15)"
                            />
                            <XAxis
                                dataKey="time"
                                interval={3}
                                scale="band"
                                tickPlacement="on"
                                padding={{ left: 0, right: 0 }}
                                tickFormatter={(time) => parseInt(time.split(':')[0], 10).toString()}
                                tick={{ fontSize: 12, fontWeight: '600', fill: '#475569' }}
                                stroke="#94a3b8"
                            />
                            <YAxis
                                domain={alertEnabled ? [0, yMax] : [0, 'auto']}
                                allowDataOverflow={alertEnabled}
                                tickCount={12}
                                tick={{ fontSize: 12, fontWeight: '600', fill: '#475569' }}
                                tickFormatter={(val) => `${val.toFixed(0)}`}
                                stroke="#94a3b8"
                            />
                            <Tooltip
                                cursor={{ stroke: '#1e293b', strokeWidth: 2 }}
                                labelFormatter={(label) => {
                                    const [hours, minutes] = label.split(':').map(Number);
                                    const date = new Date();
                                    date.setHours(hours, minutes, 0);
                                    const endDate = new Date(date.getTime() + 15 * 60000);
                                    const endLabel = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
                                    return `${label} – ${endLabel}`;
                                }}
                                contentStyle={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    padding: '10px'
                                }}
                                labelStyle={{
                                    backgroundColor: '#3365ba',
                                    padding: '4px 0',
                                    textAlign: 'center',
                                    borderRadius: '4px',
                                    display: 'block',
                                    marginBottom: '8px',
                                    color: 'white',
                                    fontWeight: '700',
                                    fontSize: '13px'
                                }}
                                itemStyle={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#1e293b',
                                    padding: '0px'
                                }}
                                formatter={(value) => [`${value.toFixed(2)} c/kWh`, 'Hinta']}
                            />
                            <ReferenceLine
                                x={nowKey}
                                stroke="#ef4444"
                                strokeWidth={3}
                                label={{ fontSize: '11px', value: 'NYT', fill: '#ef4444', position: 'top', fontWeight: 'bold', offset: 8 }}
                            />
                            <Bar dataKey="price" isAnimationActive={false}>
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
                    <div className="loading">Ladataan hintoja...</div>
                )}
            </div>
        </div>
    );
};

export default CurrentDay;
