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
        <div className="p-2">
            <div style={{ width: CHESSBOARD_WIDTH, margin: '0 auto' }}>
                <h1 className="text-2xl font-bold mb-4">Hurdles</h1>

                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: '1rem',
                }}>
                    <button
                        className={`px-4 py-2 ${view === 'review' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
                        onClick={() => setView('review')}
                    >
                        Review Hurdles
                    </button>
                    <Spacer orientation="horizontal" />
                    <button
                        className={`px-4 py-2 ${view === 'train' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
                        onClick={() => setView('train')}
                    >
                        Training Mode
                    </button>
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
                        onBack={() => {
                            setSelectedHurdle(null)
                            setView('review')
                        }}
                    />
                )}
            </div>
        </div>
    )
}
