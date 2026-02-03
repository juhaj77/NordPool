import { useEffect, useState } from 'react';
import {
    ComposedChart, // Käytetään tätä tarkempaan asetteluun
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from 'recharts';

const App = () => {
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    const ALV = 1.255;

    const fetchPrices = async (isInitial = false) => {
        if (isInitial) setLoading(true);

        const d = new Date();
        const pvm = d.toISOString().split('T')[0];
        const isLocal = window.location.hostname === 'localhost';
        const proxyPath = isLocal ? '/api' : '/api-proxy';
        const url = `${proxyPath}/api/vartti/v1/halpa?vartit=96&tulos=sarja&aikaraja=${pvm}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Virhe: ${response.status}`);
            const data = await response.json();

            const formattedData = data.map(item => ({
                time: item.aikaleima_suomi.includes('T')
                    ? item.aikaleima_suomi.split('T')[1].substring(0, 5)
                    : item.aikaleima_suomi.split(' ')[1].substring(0, 5),
                price: parseFloat(item.hinta) * ALV,
            }));

            setPrices(formattedData.sort((a, b) => a.time.localeCompare(b.time)));
            setError(null);
        } catch (err) {
            setError("Hintoja ei saatu ladattua.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrices(true);
    }, []);

    // Tarkka synkronointi minuutin vaihteeseen
    useEffect(() => {
        let timeoutId;
        const syncClock = () => {
            const now = new Date();
            setCurrentTime(prevTime => {
                if (now.getDate() !== prevTime.getDate()) {
                    fetchPrices(false);
                }
                return now;
            });

            const msUntilNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
            timeoutId = setTimeout(syncClock, msUntilNextMinute + 100);
        };
        syncClock();
        return () => clearTimeout(timeoutId);
    }, []);

    const nowKey = `${String(currentTime.getHours()).padStart(2, '0')}:${String(Math.floor(currentTime.getMinutes() / 15) * 15).padStart(2, '0')}`;

    if (error) return <div className="error-message">Virhe: {error}</div>;

    const currentPrice = prices.find(p => p.time === nowKey)?.price;
    const maxPrice = prices.length > 0 ? Math.max(...prices.map(p => p.price)) : 0;

    return (
        <div className="app-root">
            <div className="card">
                <div className="header">
                    <h1 className="title">
                        <span>⚡ Sähkön hinta tänään</span>
                        <span className="current-price">
                            NYT: {currentPrice ? `${currentPrice.toFixed(2)} c/kWh` : '--'}
                        </span>
                        <span className="max-price">
                            KALLEIN: {maxPrice ? `${maxPrice.toFixed(2)} c/kWh` : '--'}
                        </span>
                    </h1>
                </div>

                <div className="chart-container">
                    {!loading && prices.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={prices}
                                barCategoryGap={'3%'}
                                margin={{ left: 0, right: 0, top: 15 }}
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
                                    domain={[0, 'auto']}
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
                                    label={{ fontSize: '13px', value: 'NYT', fill: '#ef4444', position: 'top', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="price" isAnimationActive={false}>
                                    {prices.map((entry) => (
                                        <Cell
                                            key={`cell-${entry.time}`}
                                            fill={entry.time === nowKey ? '#ef4444' : '#3365ba'}
                                        />
                                    ))}
                                </Bar>
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="loading">Ladataan hintoja...</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;