import { useRef } from 'react';
import { usePlotArea } from 'recharts';

// Vedettävä vaakaviiva raja-arvon valintaan. Renderöidään ComposedChartin
// lapsena, jolloin usePlotArea() antaa piirtoalueen pikselikoordinaatit.
// Jaettu CurrentDay- ja Tomorrow-näkymien kesken.
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

export default DraggableThreshold;