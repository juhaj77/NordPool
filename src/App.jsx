import React, { useState } from 'react';
import CurrentDay from './CurrentDay';
import Statistics from './Statistics';
import Tomorrow from './Tomorrow';

const App = () => {
    const [tab, setTab] = useState('current');

    return (
        <div className="app-root">
            <div className="content">
                <div className="tab-navigation">
                    <button
                        onClick={() => setTab('current')}
                        style={{
                            backgroundColor: tab === 'current' ? '#ffffff' : 'transparent',
                            color: tab === 'current' ? '#3365ba' : '#64748b',
                            boxShadow: tab === 'current' ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',
                        }}
                    >
                        ⚡ Live-hinnat
                    </button>
                    <button
                        onClick={() => setTab('tomorrow')}
                        style={{
                            backgroundColor: tab === 'tomorrow' ? '#ffffff' : 'transparent',
                            color: tab === 'tomorrow' ? '#3365ba' : '#64748b',
                            boxShadow: tab === 'tomorrow' ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',
                        }}
                    >
                        ⚡ Huomenna
                    </button>
                    <button
                        onClick={() => setTab('statistics')}
                        style={{
                            backgroundColor: tab === 'statistics' ? '#ffffff' : 'transparent',
                            color: tab === 'statistics' ? '#3365ba' : '#64748b',
                            boxShadow: tab === 'statistics' ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',
                        }}
                    >
                        📊 Tilastot
                    </button>
                </div>
                <main>
                    {tab === 'current' && <CurrentDay />}
                    {tab === 'tomorrow' && <Tomorrow />}
                    {tab === 'statistics' && <Statistics />}
                </main>
            </div>
        </div>
    );
}

export default App;