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

    const fetchTomorrowPrices = async () => {
        setLoading(true);

        // Käytetään samaa pvm-logiikkaa kuin CurrentDay, mutta lisätään +1 päivä
        const d = new Date();
        d.setDate(d.getDate() + 1); // Siirrytään huomiseen

        const vuosi = d.getFullYear();
        const kuukausi = String(d.getMonth() + 1).padStart(2, '0');
        const paiva = String(d.getDate()).padStart(2, '0');
        const pvm = `${vuosi}-${kuukausi}-${paiva}`;

        const isLocal = window.location.hostname === 'localhost';
        const proxyPath = isLocal ? '/api' : '/api-proxy';

        // TÄRKEÄ: Käytetään täsmälleen samaa URL-rakennetta kuin CurrentDay.jsx:ssä
        const url = `${proxyPath}/api/vartti/v1/halpa?vartit=96&tulos=sarja&aikaraja=${pvm}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    setPrices([]); // Tulkitaan 404 "ei vielä julkaistu" tilaksi
                    return;
                }
                throw new Error(`Virhe: ${response.status}`);
            }

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
        fetchTomorrowPrices();
    }, []);

    const maxPrice = prices.length > 0 ? Math.max(...prices.map(p => p.price)) : 0;

    // Näytetään ilmoitus, jos dataa ei ole (haku palautti tyhjää tai 404)
    if (!loading && prices.length === 0) {
        return (
            <div className="card">
                <div className="header">
                    <h1 className="title">⚡ Sähkön hinta huomenna</h1>
                </div>
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <p style={{ color: '#1e293b', fontSize: '1.2rem', fontWeight: '700', marginBottom: '8px' }}>
                        Huomisen dataa ei ole vielä julkaistu.
                    </p>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        Hinnat julkaistaan yleensä klo 14:00 jälkeen.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="header">
                <h1 className="title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span>⚡ Sähkön hinta huomenna</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>
                        KALLEIN: {maxPrice ? `${maxPrice.toFixed(2)} c/kWh` : '--'}
                    </span>
                </h1>
            </div>

            <div className="chart-container">
                {loading ? (
                    <div className="loading">Ladataan huomisen hintoja...</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                        <ComposedChart
                            data={prices}
                            barCategoryGap={'3%'}
                            margin={{ left: 0, right: 0, top: 20 }}
                        >
                            <CartesianGrid strokeDasharray="0" vertical={true} horizontal={true} stroke="rgba(0,0,0,0.15)" />
                            <XAxis
                                dataKey="time"
                                interval={3}
                                tickFormatter={(time) => parseInt(time.split(':')[0], 10).toString()}
                                tick={{ fontSize: 12, fontWeight: '600', fill: '#475569' }}
                                stroke="#94a3b8"
                            />
                            <YAxis
                                domain={[0, 'auto']}
                                tickCount={10}
                                tick={{ fontSize: 12, fontWeight: '600', fill: '#475569' }}
                                tickFormatter={(val) => `${val.toFixed(0)}`}
                                stroke="#94a3b8"
                            />
                            <Tooltip
                                cursor={{ stroke: '#1e293b', strokeWidth: 2 }}
                                labelFormatter={(label) => `Klo ${label}`}
                                contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ color: '#1e293b', fontWeight: '700' }}
                                labelStyle={{ color: '#3365ba', fontWeight: '800', marginBottom: '4px' }}
                                formatter={(value) => [`${value.toFixed(2)} c/kWh`, 'Hinta']}
                            />
                            <Bar dataKey="price" isAnimationActive={false}>
                                {prices.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.price === maxPrice ? '#ef4444' : '#3365ba'}
                                    />
                                ))}
                            </Bar>
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default Tomorrow;