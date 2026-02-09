import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Spacer } from '~stzUtils/components/Spacer'
import { HurdleReview } from '~/components/HurdleReview'
import { HurdleTrainer } from '~/components/HurdleTrainer'
import { HurdleTable } from '~/lib/chess-database'
import { CHESSBOARD_WIDTH } from '~/constants'

export const Route = createFileRoute('/hurdles')({
    component: HurdlesPage,
})

function HurdlesPage() {
    const [view, setView] = useState<'review' | 'train'>('review')
    const [hurdlesRefreshKey, setHurdlesRefreshKey] = useState(0)
    const [selectedHurdle, setSelectedHurdle] = useState<HurdleTable | null>(null)

    return (
        <div style={{ padding: '0.5rem' }}>
            <div style={{ width: CHESSBOARD_WIDTH, margin: '0 auto' }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1.5rem',
                }}>
                    <div style={{
                        display: 'flex',
                        backgroundColor: 'var(--color-bg-secondary)',
                        padding: '6px', // Equal padding all around
                        borderRadius: '10px',
                        width: '100%',
                        maxWidth: '460px'
                    }}>
                        <button
                            onClick={() => setView('review')}
                            style={{
                                flex: 1,
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.95em',
                                fontWeight: '600',
                                backgroundColor: view === 'review' ? 'var(--color-bg)' : 'transparent', // White/Bg for active
                                color: view === 'review' ? 'var(--color-text)' : 'var(--color-text-secondary)', // Black/Text for active
                                boxShadow: view === 'review' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Hurdle List
                        </button>
                        <button
                            onClick={() => setView('train')}
                            style={{
                                flex: 1,
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.95em',
                                fontWeight: '600',
                                backgroundColor: view === 'train' ? 'var(--color-bg)' : 'transparent', // White/Bg for active
                                color: view === 'train' ? 'var(--color-text)' : 'var(--color-text-secondary)', // Black/Text for active
                                boxShadow: view === 'train' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Training Mode
                        </button>
                    </div>
                </div>

                {view === 'review' ? (
                    <HurdleReview
                        key={hurdlesRefreshKey}
                        onSelectHurdle={(hurdle) => {
                            setSelectedHurdle(hurdle)
                            setView('train')
                        }}
                    />
                ) : (
                    <HurdleTrainer
                        hurdle={selectedHurdle || undefined}
                    />
                )}
            </div>
        </div>
    )
}
