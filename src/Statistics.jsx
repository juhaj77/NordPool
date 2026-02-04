import { useEffect, useState, useMemo } from 'react';
import {
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';

// Tuodaan keskihajonnan ikoni assets-kansiosta
import stdIcon from '../assets/population_standard_deviation.svg';

const Statistics = () => {
    const [rawPrices, setRawPrices] = useState([]);
    const [daysToFetch, setDaysToFetch] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    const ALV = 1.255;

    const fetchPrices = async () => {
        setLoading(true);
        const allData = [];

        try {
            for (let i = 0; i < daysToFetch; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const pvm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                const isLocal = window.location.hostname === 'localhost';
                const proxyPath = isLocal ? '/api' : '/api-proxy';
                const url = `${proxyPath}/api/vartti/v1/halpa?vartit=96&tulos=sarja&aikaraja=${pvm}`;

                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    allData.push(...data);
                }
            }

            if (allData.length === 0) throw new Error("Hintoja ei saatu ladattua.");

            const formatted = allData.map(item => ({
                time: (item.aikaleima_suomi.includes('T') ? item.aikaleima_suomi.split('T')[1] : item.aikaleima_suomi.split(' ')[1]).substring(0, 5),
                price: parseFloat(item.hinta) * ALV,
            }));

            setRawPrices(formatted);
            setError(null);
        } catch (err) {
            setError("Hintoja ei saatu ladattua.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrices();
    }, [daysToFetch]);

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const chartData = useMemo(() => {
        if (rawPrices.length === 0) return [];

        const grouped = rawPrices.reduce((acc, curr) => {
            if (!acc[curr.time]) acc[curr.time] = [];
            acc[curr.time].push(curr.price);
            return acc;
        }, {});

        return Object.keys(grouped).sort().map(time => {
            const values = grouped[time];
            const n = values.length;
            const avg = values.reduce((a, b) => a + b, 0) / n;
            const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / n;
            const stdDev = Math.sqrt(variance);

            return {
                time,
                avg,
                stdRange: [avg - stdDev, avg + stdDev],
                currentDayPrice: values[0],
                stdDev: stdDev
            };
        });
    }, [rawPrices]);

    const nowKey = `${String(currentTime.getHours()).padStart(2, '0')}:${String(Math.floor(currentTime.getMinutes() / 15) * 15).padStart(2, '0')}`;

    return (
        <div className="card">
            <div className="header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
            }}>
                <h1 className="title" style={{ margin: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                    <span>⚡ {daysToFetch > 1 ? `${daysToFetch} pv keskiarvo & ` : 'Sähkön hinta tänään'}</span>
                    {daysToFetch > 1 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                            keskihajonta
                            <img
                                src={stdIcon}
                                alt="Standard Deviation"
                                style={{
                                    height: '2em',
                                    verticalAlign: 'middle'
                                }}
                            />
                        </span>
                    )}
                    </div>
                </h1>

                <div className="controls" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <label style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b' }}>Päivät:</label>
                    <select
                        value={daysToFetch}
                        onChange={(e) => setDaysToFetch(Number(e.target.value))}
                        style={{
                            fontSize: '1.25rem',
                            fontWeight: '700',
                            color: '#3365ba',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            border: '2px solid #e2e8f0',
                            backgroundColor: '#ffffff',
                            cursor: 'pointer'
                        }}
                    >
                        {[1, 2, 3, 7, 14, 30].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
            </div>

            <div className="chart-container">
                {!loading ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} barCategoryGap={'3%'} margin={{ left: 0, right: 0, top: 20 }}>
                            <CartesianGrid strokeDasharray="0" vertical={true} horizontal={true} stroke="rgba(0,0,0,0.1)"/>
                            <XAxis
                                dataKey="time"
                                interval={7}
                                tickFormatter={(t) => t.split(':')[0]}
                                tick={{fontSize: 11, fill: '#64748b'}}
                            />
                            <YAxis tick={{fontSize: 11, fill: '#64748b'}} tickFormatter={(v) => v.toFixed(0)} />

                            <Tooltip
                                labelFormatter={(label) => `Klo ${label}`}
                                // TUMMENNUS TÄSSÄ:
                                contentStyle={{
                                    borderRadius: '10px',
                                    border: 'none',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    color: '#1e293b'
                                }}
                                itemStyle={{
                                    color: '#1e293b',
                                    fontWeight: '600',
                                    padding: '2px 0'
                                }}
                                labelStyle={{ fontWeight: '800', marginBottom: '4px', color: '#3365ba' }}
                                formatter={(value, name, props) => {
                                    if (name === "stdRange") {
                                        const stdValue = props.payload.stdDev;
                                        return [`±${stdValue.toFixed(2)} c/kWh`, 'Keskihajonta'];
                                    }
                                    if (name === "avg") return [`${value.toFixed(2)} c/kWh`, 'Keskiarvo'];
                                    return [`${value.toFixed(2)} c/kWh`, 'Hinta'];
                                }}
                            />

                            {daysToFetch > 1 && (
                                <Area
                                    type="monotone"
                                    dataKey="stdRange"
                                    fill="#cbd5e1"
                                    stroke="none"
                                    name="stdRange"
                                    isAnimationActive={false} />
                            )}

                            {daysToFetch === 1 && (
                                <Line
                                    type="stepAfter"
                                    dataKey="currentDayPrice"
                                    stroke="#3365ba"
                                    strokeWidth={3}
                                    dot={false}
                                    name="currentDayPrice"
                                    isAnimationActive={false} />
                            )}

                            {daysToFetch > 1 && (
                                <Line
                                    type="monotone"
                                    dataKey="avg"
                                    stroke="#1e293b"
                                    strokeWidth={2}
                                    dot={false}
                                    name="avg"
                                    isAnimationActive={false} />
                            )}

                            <ReferenceLine x={nowKey} stroke="#ef4444" strokeWidth={2} label={{ value: 'NYT', position: 'top', fill: '#ef4444', fontSize: 10 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : <div className="loading">Ladataan tilastoja...</div>}
            </div>
        </div>
    );
};

export default Statistics;