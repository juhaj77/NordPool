import React, { useState } from 'react';
import CurrentDay from './CurrentDay';
import Statistics from './Statistics';
import Tomorrow from './Tomorrow';

const App = () => {
    const [tab, setTab] = useState('current');

    return (
        <div className="app-root" style={{
            backgroundColor: '#f1f5f9',
            minHeight: '100vh',

        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>

                {/* Välilehtivalinta kortin yläpuolella */}
                <div className="tab-navigation" style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '1em',
                    marginLeft: '0'
                }}>
                    <button
                        onClick={() => setTab('current')}
                        style={{
                            padding: '5px 24px',
                            fontSize: '14px',
                            fontWeight: '700',
                            borderRadius: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: tab === 'current' ? '#ffffff' : 'transparent',
                            color: tab === 'current' ? '#3365ba' : '#64748b',
                            boxShadow: tab === 'current' ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',
                            transition: 'all 0.2s ease-in-out',
                        }}
                    >
                        ⚡ Live-hinnat
                    </button>
                    <button
                        onClick={() => setTab('tomorrow')}
                        style={{
                            padding: '5px 24px',
                            fontSize: '14px',
                            fontWeight: '700',
                            borderRadius: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: tab === 'tomorrow' ? '#ffffff' : 'transparent',
                            color: tab === 'tomorrow' ? '#3365ba' : '#64748b',
                            boxShadow: tab === 'tomorrow' ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',
                            transition: 'all 0.2s ease-in-out',
                        }}
                    >
                        ⚡ Huomenna
                    </button>
                    <button
                        onClick={() => setTab('statistics')}
                        style={{
                            padding: '5px 24px',
                            fontSize: '14px',
                            fontWeight: '700',
                            borderRadius: '10px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: tab === 'statistics' ? '#ffffff' : 'transparent',
                            color: tab === 'statistics' ? '#3365ba' : '#64748b',
                            boxShadow: tab === 'statistics' ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',

                        }}
                    >
                        📊 Tilastot
                    </button>
                </div>

                {/* Itse sisältökortit */}
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