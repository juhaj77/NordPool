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

    const maxPrice = prices.length > 0 ? Math.max(...prices.map(p => p.price)) : 0;
    // Kiinteä Y-akselin yläraja pitää viivan ja pylväiden skaalan samana
    const yMax = Math.max(1, Math.ceil(maxPrice * 1.1));

    const barColor = (entry) => {
        if (alertEnabled && entry.price > alertThreshold) return '#f59e0b';
        return '#3365ba';
    };

    const adjustThreshold = (delta) => {
        setAlertThreshold(Math.max(0, Math.min(yMax, Math.round((alertThreshold + delta) * 10) / 10)));
    };

    const hasData = !loading && prices.length > 0;

    return (
        <div className="card">
            <div className="header">
                <h1 className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span>⚡ Sähkön hinta huomenna</span>
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
                    <span className="alert-label">Ennakkohälytys</span>

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

                    {alertEnabled && googleAuthed && hasData && (
                        <button
                            type="button"
                            className="save-offline-btn"
                            onClick={saveTomorrowAlertsToCalendar}
                            disabled={saving}
                        >
                            {saving ? 'Tallennetaan...' : '📅 Tallenna hälytykset kalenteriin'}
                        </button>
                    )}

                    {savedCount !== null && !saving && (
                        <span className={savedCount > 0 ? 'alert-google-badge' : 'alert-hint'}>
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
                            ? <span className="alert-hint">Vedä keltaista viivaa säätääksesi rajaa</span>
                            : <span className="alert-hint">Huomisen hinnat julkaistaan arviolta klo 14:15</span>
                    )}
                </div>
            </div>

            <div className="chart-container">
                {loading ? (
                    <div className="loading">Ladataan hintoja...</div>
                ) : hasData ? (
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
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
                                    over={false}
                                    onChange={setAlertThreshold}
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="no-tomorrow">
                        Huomisen hinnat julkaistaan arviolta klo 14:15.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Tomorrow;