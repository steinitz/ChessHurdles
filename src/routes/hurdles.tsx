import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { Chess } from 'chess.js'
import { Spacer } from '~stzUtils/components/Spacer'
import { HurdleList } from '~/components/HurdleList'
import { HurdleTrainer } from '~/components/HurdleTrainer'
import { ChessBoard } from '~/components/ChessBoard'
import { HurdleTable } from '~/lib/chess-database'
import { CHESSBOARD_WIDTH } from '~/constants'

export const Route = createFileRoute('/hurdles')({
    component: HurdlesPage,
})

function HurdlesPage() {
    const [view, setView] = useState<'list' | 'train'>('list')
    const [selectedHurdle, setSelectedHurdle] = useState<HurdleTable | null>(null)
    const [game, setGame] = useState(() => new Chess())
    const [customSquareStyles, setCustomSquareStyles] = useState<Record<string, any>>({})

    // Training state lifted to parent
    const [message, setMessage] = useState<string>('Find the best move')
    const [isSolved, setIsSolved] = useState(false)

    // Synchronize game state with selected hurdle
    useEffect(() => {
        if (selectedHurdle?.fen) {
            setGame(new Chess(selectedHurdle.fen))
            setMessage('Find the best move')
            setIsSolved(false)
            setCustomSquareStyles({})
        }
    }, [selectedHurdle])

    const handleHurdleSelect = (hurdle: HurdleTable) => {
        setSelectedHurdle(hurdle)
    }

    const handleMove = useCallback((moveSan: string) => {
        if (view === 'train' && isSolved) return

        setGame(prev => {
            const next = new Chess(prev.fen())
            try {
                const moveResult = next.move(moveSan)
                if (moveResult) {
                    if (view === 'train' && selectedHurdle) {
                        const playedMoveUci = moveResult.from + moveResult.to + (moveResult.promotion || '')
                        const cleanBestMove = (selectedHurdle.best_move || '').replace(/^\d+\.+/, '').trim()

                        const isBestMove = moveSan === cleanBestMove || playedMoveUci === cleanBestMove

                        if (isBestMove) {
                            setMessage('Correct. Well done')
                            setIsSolved(true)
                            return next
                        } else {
                            setMessage('Incorrect. Try again')
                            setTimeout(() => {
                                setGame(new Chess(selectedHurdle.fen))
                                setMessage('Try again...')
                            }, 1000)
                            return prev // Revert on failure
                        }
                    }
                    return next // List mode: just move
                }
                return prev
            } catch {
                return prev
            }
        })
    }, [view, isSolved, selectedHurdle])

    return (
        <div style={{ padding: '0.5rem' }}>
            <div style={{ width: CHESSBOARD_WIDTH, margin: '0 auto' }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                }}>
                    <div style={{
                        display: 'flex',
                        backgroundColor: 'var(--color-bg-secondary)',
                        padding: '6px',
                        borderRadius: '10px',
                        width: '100%',
                        maxWidth: '460px'
                    }}>
                        <button
                            onClick={() => setView('list')}
                            style={{
                                flex: 1,
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.95em',
                                fontWeight: '600',
                                backgroundColor: view === 'list' ? 'var(--color-bg)' : 'transparent',
                                color: view === 'list' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                boxShadow: view === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
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
                                backgroundColor: view === 'train' ? 'var(--color-bg)' : 'transparent',
                                color: view === 'train' ? 'var(--color-text)' : 'var(--color-text-secondary)',
                                boxShadow: view === 'train' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Training Mode
                        </button>
                    </div>
                </div>

                {/* Persistent Board Area */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: '100%',
                    marginBottom: '1rem'
                }}>
                    <ChessBoard
                        game={game}
                        onMove={handleMove}
                        boardSize={CHESSBOARD_WIDTH}
                        customSquareStyles={customSquareStyles}
                    />
                </div>

                {view === 'list' ? (
                    <HurdleList
                        selectedId={selectedHurdle?.id || null}
                        onSelect={handleHurdleSelect}
                    />
                ) : (
                    <HurdleTrainer
                        hurdle={selectedHurdle || undefined}
                        game={game}
                        message={message}
                        isSolved={isSolved}
                        setCustomSquareStyles={setCustomSquareStyles}
                        onHurdleChange={setSelectedHurdle}
                    />
                )}
            </div>
        </div>
    )
}
