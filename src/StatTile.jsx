// Referenssin "ALERTS / RATE / SOURCES" -tyylinen tunnuslukutiili
const StatTile = ({ label, value, unit, sub, tone }) => (
    <div className={`stat${tone ? ` stat-${tone}` : ''}`}>
        <div className="stat-label">{label}</div>
        <div className="stat-value">
            {value ?? '--'}
            {value != null && unit && <span className="stat-unit">{unit}</span>}
        </div>
        {sub && <div className="stat-sub">{sub}</div>}
    </div>
);

export default StatTile;
