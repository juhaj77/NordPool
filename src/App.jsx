import React, { useState } from 'react';
import CurrentDay from './CurrentDay';
import Statistics from './Statistics';

const App = () => {
    const [isCurrentDay, setIsCurrentDay] = useState(true);

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
                    marginBottom: '12px',
                    marginLeft: '4px'
                }}>
                    <button
                        onClick={() => setIsCurrentDay(true)}
                        style={{
                            padding: '10px 24px',
                            fontSize: '14px',
                            fontWeight: '700',
                            borderRadius: '10px 10px 10px 10px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: isCurrentDay ? '#ffffff' : 'transparent',
                            color: isCurrentDay ? '#3365ba' : '#64748b',
                            boxShadow: isCurrentDay ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        ⚡ Live-hinnat
                    </button>
                    <button
                        onClick={() => setIsCurrentDay(false)}
                        style={{
                            padding: '10px 24px',
                            fontSize: '14px',
                            fontWeight: '700',
                            borderRadius: '10px 10px 10px 10px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: !isCurrentDay ? '#ffffff' : 'transparent',
                            color: !isCurrentDay ? '#3365ba' : '#64748b',
                            boxShadow: !isCurrentDay ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        📊 Tilastot
                    </button>
                </div>

                {/* Itse sisältökortit */}
                <main>
                    {isCurrentDay ? <CurrentDay /> : <Statistics />}
                </main>
            </div>
        </div>
    );
}

export default App;