import React, { useState } from 'react';
import CurrentDay from './CurrentDay';
import Statistics from './Statistics';
import Tomorrow from './Tomorrow';
import { PriceProvider } from './PriceContext';

const TABS = [
    { id: 'current', label: 'Live-hinnat' },
    { id: 'tomorrow', label: 'Huomenna' },
    { id: 'statistics', label: 'Tilastot' },
];

const App = () => {
    const [tab, setTab] = useState('current');

    return (
        <PriceProvider>
            <div className="app-root">
                <nav className="topbar">
                    <span className="brand">⚡ Sähkö</span>
                    <div className="tab-navigation">
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                type="button"
                                className={tab === t.id ? 'active' : ''}
                                onClick={() => setTab(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </nav>
                <main className="content">
                    {tab === 'current' && <CurrentDay />}
                    {tab === 'tomorrow' && <Tomorrow />}
                    {tab === 'statistics' && <Statistics />}
                </main>
            </div>
        </PriceProvider>
    );
}

export default App;
