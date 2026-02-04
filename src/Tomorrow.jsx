import { useEffect, useState } from 'react';
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

const Tomorrow = () => {
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const ALV = 1.255;

    const fetchPrices = async (isInitial = false) => {
        if (isInitial) setLoading(true);

        const d = new Date();
        d.setDate(d.getDate() + 1); // Huominen
        const vuosi = d.getFullYear();
        const kuukausi = String(d.getMonth() + 1).padStart(2, '0');
        const paiva = String(d.getDate()).padStart(2, '0');
        const pvm = `${vuosi}-${kuukausi}-${paiva}`;

        const isLocal = window.location.hostname === 'localhost';
        const proxyPath = isLocal ? '/api' : '/api-proxy';
        // Käytetään täsmälleen samaa URL-rakennetta kuin CurrentDay
        const url = `${proxyPath}/api/vartti/v1/halpa?vartit=96&tulos=sarja&aikaraja=${pvm}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Virhe: ${response.status}`);
            const data = await response.json();

            if (!data || data.length === 0) {
                setPrices([]);
            } else {
                const formattedData = data.map(item => ({
                    time: item.aikaleima_suomi.includes('T')
                        ? item.aikaleima_suomi.split('T')[1].substring(0, 5)
                        : item.aikaleima_suomi.split(' ')[1].substring(0, 5),
                    price: parseFloat(item.hinta) * ALV,
                }));

                setPrices(formattedData.sort((a, b) => a.time.localeCompare(b.time)));
            }
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

    const maxPrice = prices.length > 0 ? Math.max(...prices.map(p => p.price)) : 0;

    // Pehmeä alpha 0.3 varjo oikealle alas
    const cardStyle = {
        boxShadow: '10px 10px 20px rgba(0, 0, 0, 0.3)',
    };

    if (!loading && prices.length === 0) {
        return (
            <div className="card" style={cardStyle}>
                <div className="header">
                    <h1 className="title">⚡ Sähkön hinta huomenna</h1>
                </div>
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: '1.2rem', fontWeight: '600' }}>
                    Huomisen dataa ei ole vielä julkaistu.
                </div>
            </div>
        );
    }

    return (
        <div className="card" style={cardStyle}>
            <div className="header">
                <h1 className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span>⚡ Sähkön hinta huomenna</span>
                    <span className="max-price">
                        KALLEIN: {maxPrice ? `${maxPrice.toFixed(2)} c/kWh` : '--'}
                    </span>
                </h1>
            </div>

            <div className="chart-container">
                {!loading && prices.length > 0 ? (
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
                                scale="band" // Tämä ja tickPlacement pitävät palkit kohdallaan
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
                            {/* Kaikki palkit sinisiä, ei punaista korostusta */}
                            <Bar dataKey="price" fill="#3365ba" isAnimationActive={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="loading">Ladataan hintoja...</div>
                )}
            </div>
        </div>
    );
};

export default Tomorrow;