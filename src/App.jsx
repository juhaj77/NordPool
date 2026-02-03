import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

const App = () => {
    const [prices, setPrices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Pidetään kellonaika statessa, jotta UI reagoi siihen heti
    const [currentTime, setCurrentTime] = useState(new Date());

    const ALV = 1.255;

    const fetchPrices = async (isInitial = false) => {
        // Näytetään latausruutu vain ensimmäisellä kerralla
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

    // Alkuperäinen haku
    useEffect(() => {
        fetchPrices(true);
    }, []);

    useEffect(() => {
        let timeoutId;

        const syncClock = () => {
            const now = new Date();

            // 1. Päivitetään kello statessa (ja katsotaan samalla vaihtuiko päivä)
            setCurrentTime(prevTime => {
                if (now.getDate() !== prevTime.getDate()) {
                    fetchPrices(false);
                }
                return now;
            });

            // 2. Lasketaan tarkka aika seuraavaan tasaminuuttiin
            // getSeconds() ja getMilliseconds() kertovat kuinka paljon ollaan jo minuutin yli
            const msPassedThisMinute = (now.getSeconds() * 1000) + now.getMilliseconds();
            const msUntilNextMinute = 60000 - msPassedThisMinute;

            // 3. Asetetaan uusi "herätys" seuraavan minuutin kohdalle.
            // +100ms on vain pieni varmistusvara, jotta Date-objekti on varmasti ehtinyt vaihtua.
            // Koska msUntilNextMinute lasketaan aina nollasta, viive ei koskaan kasva.
            timeoutId = setTimeout(syncClock, msUntilNextMinute + 100);
        };

        syncClock(); // Käynnistetään ensimmäinen kierros

        return () => clearTimeout(timeoutId); // Tuhotaan ajastin jos sivu suljetaan
    }, []);

    // Lasketaan nyt-avain statessa olevan kellon mukaan
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
                            <BarChart data={prices} barGap={0} barCategoryGap="5%">
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
                                    interval={0}
                                    tick={{ fontSize: 12, fontWeight: '600', fill: '#475569' }}
                                    tickFormatter={(val) => `${val.toFixed(0)}`}
                                    stroke="#94a3b8"
                                />
                                <Tooltip
                                    labelFormatter={(label) => {
                                        const [hours, minutes] = label.split(':').map(Number);
                                        const date = new Date();
                                        date.setHours(hours, minutes, 0);
                                        const endDate = new Date(date.getTime() + 15 * 60000);
                                        const endLabel = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
                                        return `${label} – ${endLabel}`;
                                    }}
                                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '10px' }}
                                    labelStyle={{ backgroundColor: '#b4c6d8', paddingTop: '4px', paddingBottom: '4px', textAlign: 'center', borderRadius: '4px', display: 'block', marginBottom: '8px', color: '#475569', fontWeight: '700', fontSize: '13px' }}
                                    itemStyle={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', padding: '0px' }}
                                    formatter={(value) => [`${value.toFixed(2)} c/kWh`, 'Hinta']}
                                />
                                <ReferenceLine x={nowKey} stroke="#ef4444" strokeWidth={3} label={{ value: 'NYT', fill: '#ef4444', position: 'top', fontWeight: 'bold' }} />
                                <Bar dataKey="price" isAnimationActive={false}>
                                    {prices.map((entry) => (
                                        <Cell
                                            key={`cell-${entry.time}`}
                                            fill={entry.time === nowKey ? '#ef4444' : '#3b82f6'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
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