import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

const App = () => {
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const ALV = 1.255;

    const fetchPrices = async () => {
        setLoading(true);
        const d = new Date();
        const pvm = d.toISOString().split('T')[0];

        // Jos ollaan localhostissa, käytetään Vite-proxyä (/api)
        // Jos ollaan Renderissä, käytetään Render-proxyä (/api-proxy)
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
        fetchPrices();
    }, []);

    // 3. Automaattinen päivitys
    useEffect(() => {
        const interval = setInterval(() => {
            const d = new Date();
            // Tarkistetaan ollaanko uuden vartin alussa (0-10 sekuntia yli)
            if (d.getMinutes() % 15 === 0 && d.getSeconds() < 10) {
                fetchPrices();
            }
        }, 10000); // 10 sekunnin välein tapahtuva tarkistus

        return () => clearInterval(interval);
    }, []);

    const now = new Date();
    const nowKey = `${String(now.getHours()).padStart(2, '0')}:${String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0')}`;

    if (error) return <div className="error-message">Virhe: {error}</div>;
// Etsitään tämän hetken hinta
    const currentPrice = prices.find(p => p.time === nowKey)?.price;

// Etsitään vuorokauden kallein hinta
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
                            <BarChart data={prices} barGap={0} barCategoryGap="15%">
                                {/* Tummempia ruudukon viivoja */}
                                <CartesianGrid strokeDasharray="0" vertical={true} horizontal={true} stroke="rgba(0,0,0,0.15)" />

                                <XAxis
                                    dataKey="time"
                                    interval={3}
                                    tickFormatter={(time) => {
                                        // Otetaan "14:15" -> "14" tai "08:00" -> "8"
                                        const hour = time.split(':')[0];
                                        return parseInt(hour, 10).toString();
                                    }}
                                    tick={{ fontSize: 12, fontWeight: '600', fill: '#475569' }}
                                    stroke="#94a3b8"
                                />
                                <YAxis
                                    domain={[0, (dataMax) => Math.ceil(dataMax * 1.1)]}
                                    tickCount={10}
                                    tick={{ fontSize: 12, fontWeight: '600', fill: '#475569' }}
                                    tickFormatter={(val) => `${val.toFixed(0)}`}
                                    stroke="#94a3b8"
                                />
                                <Tooltip
                                    // Lasketaan aikaväli: 13:15 -> 13:15 – 13:30
                                    labelFormatter={(label) => {
                                        const [hours, minutes] = label.split(':').map(Number);
                                        const date = new Date();
                                        date.setHours(hours, minutes, 0);

                                        // Lisätään 15 minuuttia
                                        const endDate = new Date(date.getTime() + 15 * 60000);
                                        const endLabel = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

                                        return `${label} – ${endLabel}`;
                                    }}
                                    // Tooltipin laatikon tyyli
                                    contentStyle={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        padding: '10px'
                                    }}
                                    // Kellonajan (label) tyyli
                                    labelStyle={{
                                        backgroundColor: '#b4c6d8', // Vaaleanharmaa tausta
                                        paddingTop: '4px',
                                        paddingBottom: '4px',
                                        textAlign: 'center',
                                        borderRadius: '4px',
                                        display: 'block',
                                        marginBottom: '8px',
                                        color: '#475569',
                                        fontWeight: '700',
                                        fontSize: '13px'
                                    }}
                                    itemStyle={{
                                        fontSize: '13px',      // Suurempi fontti hinnalle
                                        fontWeight: '600',
                                        color: '#1e293b',      // Hieman tummempi harmaa/musta
                                        fontFamily: 'Funnel Sans',
                                        padding: '0px'         // Poistetaan turha tyhjä tila
                                    }}
                                    formatter={(value) => [`${value.toFixed(2)} c/kWh`, 'Hinta']}
                                />

                                <ReferenceLine x={nowKey} stroke="#ef4444" strokeWidth={3} label={{ value: 'NYT', fill: '#ef4444', position: 'top', fontWeight: 'bold' }} />

                                <Bar dataKey="price"
                                     isAnimationActive={false}>
                                    {prices.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.time === nowKey ? '#ef4444' : '#3b82f6'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="loading">
                            {loading ? "Ladataan hintoja..." : "Hintoja ei saatu ladattua."}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;