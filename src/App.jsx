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
                    gap: '9px',
                    marginBottom: '0',
                    marginLeft: '0'
                }}>
                    <button
                        onClick={() => setTab('current')}
                        style={{
                            padding: '5px 24px',
                            fontSize: '14px',
                            fontWeight: '700',
                            borderRadius: '10px 10px 0px 0px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: tab === 'current' ? '#ffffff' : '#dee4ef',
                            color: tab === 'current' ? '#3365ba' : '#64748b',
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
                            borderRadius: '10px 10px 0px 0px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: tab === 'tomorrow' ? '#ffffff' : '#dee4ef',
                            color: tab === 'tomorrow' ? '#3365ba' : '#64748b',
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
                            borderRadius: '10px 10px 0px 0px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: tab === 'statistics' ? '#ffffff' : '#dee4ef',
                            color: tab === 'statistics' ? '#3365ba' : '#64748b',
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