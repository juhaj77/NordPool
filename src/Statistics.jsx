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

import stdIcon from '../assets/population_standard_deviation.svg';
import { useChartTheme } from './theme';

const Statistics = () => {
    const { C, gridStroke, axisStroke, axisTick, tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } = useChartTheme();
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
        <div className="view">
            <div className="panel toolbar">
                <div className="alert-controls">
                    <span className="toolbar-label">Ikkuna</span>
                    <div className="segmented">
                        {[1, 2, 3, 7, 14, 30].map(v => (
                            <button
                                key={v}
                                type="button"
                                className={daysToFetch === v ? 'active' : ''}
                                onClick={() => setDaysToFetch(v)}
                            >
                                {v} pv
                            </button>
                        ))}
                    </div>
                    <span className="alert-hint">
                        {daysToFetch > 1 ? `${daysToFetch} viimeisintä päivää` : 'vain tämä päivä'}
                    </span>
                </div>
            </div>

            <div className="panel chart-panel">
                <div className="panel-title">
                    {daysToFetch > 1 ? `${daysToFetch} pv keskiarvo & keskihajonta` : 'Sähkön hinta tänään'}
                    {daysToFetch > 1 && (
                        <img className="std-icon" src={stdIcon} alt="Keskihajonta" />
                    )}
                    <span className="panel-sub">sis. ALV 25,5 % · c/kWh</span>
                </div>
                <div className="chart-container">
                    {!loading ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ left: -10, right: 0, top: 20 }}>
                                <CartesianGrid vertical={false} stroke={gridStroke} />
                                <XAxis
                                    dataKey="time"
                                    interval={7}
                                    tickFormatter={(t) => t.split(':')[0]}
                                    tick={axisTick}
                                    stroke={axisStroke}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={axisTick}
                                    tickFormatter={(v) => v.toFixed(0)}
                                    axisLine={false}
                                    tickLine={false}
                                />

                                <Tooltip
                                    cursor={{ stroke: C.borderStrong, strokeWidth: 1 }}
                                    labelFormatter={(label) => `klo ${label}`}
                                    contentStyle={tooltipContentStyle}
                                    labelStyle={tooltipLabelStyle}
                                    itemStyle={tooltipItemStyle}
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
                                        fill={C.blue}
                                        fillOpacity={0.18}
                                        stroke="none"
                                        name="stdRange"
                                        isAnimationActive={false} />
                                )}

                                {daysToFetch === 1 && (
                                    <Line
                                        type="stepAfter"
                                        dataKey="currentDayPrice"
                                        stroke={C.blue}
                                        strokeWidth={2}
                                        dot={false}
                                        name="currentDayPrice"
                                        isAnimationActive={false} />
                                )}

                                {daysToFetch > 1 && (
                                    <Line
                                        type="monotone"
                                        dataKey="avg"
                                        stroke={C.teal}
                                        strokeWidth={2}
                                        dot={false}
                                        name="avg"
                                        isAnimationActive={false} />
                                )}

                                <ReferenceLine x={nowKey} stroke={C.red} strokeWidth={2} label={{ value: 'NYT', position: 'top', fill: C.red, fontSize: 10, fontWeight: 700 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : <div className="loading">Ladataan tilastoja…</div>}
                </div>
            </div>
        </div>
    );
};

export default Statistics;