import React from 'react';
import type { AnalysisDisplayItem } from './analysis-formatter';

export interface AnalysisCardProps {
    item: AnalysisDisplayItem;
    onClick: () => void;
    isActive: boolean;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ item, onClick, isActive }) => {
    const classification = item.classification || 'none';

    // Suffix for move annotation
    const suffix = classification === 'blunder' ? '??'
        : classification === 'mistake' ? '?'
            : classification === 'inaccuracy' ? '?!'
                : '';

    const preEval = item.evaluation;
    const postEval = item.postMoveEvaluation;
    const hasPost = postEval !== undefined;

    const formatEval = (v: number) => {
        if (item.mateIn) return `M${Math.abs(item.mateIn)}`;
        const sign = v > 0 ? '+' : '';
        return `${sign}${(v / 100).toFixed(2)}`;
    }

    const preText = formatEval(preEval);
    const postText = hasPost ? formatEval(postEval!) : '?';

    // Eval Color (based on Post if avail, else Pre)
    const evalVal = hasPost ? postEval! : preEval;
    const evalColor = evalVal > 0 ? 'var(--color-success)' : evalVal < 0 ? 'var(--color-error)' : 'var(--color-text-secondary)';

    // Text Logic (Best Move or AI Description)
    let displayText = '';

    if (item.aiDescription) {
        displayText = item.aiDescription;
    } else if (item.pv) {
        // Only show PV if it's not redundant?
        displayText = `Best: ${item.pv}`;
    } else if (item.bestMove && item.bestMove !== '?') {
        displayText = `Best: ${item.bestMove}`;
    }

    // Truncate
    const truncatedText = displayText.length > 60 ? displayText.slice(0, 60) + '...' : displayText;

    const labelColor = classification === 'blunder' ? 'var(--color-error)'
        : classification === 'mistake' ? 'var(--color-text)'
            : 'var(--color-text-secondary)';

    return (
        <div
            className={`analysis-card ${classification} ${isActive ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
            {/* Col 1: Move Number */}
            <span style={{ color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                {item.moveLabel}
            </span>

            {/* Col 2: Move Sanitized */}
            <span style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>
                {item.moveSan}{suffix}
            </span>

            {/* Col 3: Eval */}
            <span style={{ fontSize: '0.9em', whiteSpace: 'nowrap' }}>
                {item.centipawnChange && item.centipawnChange > 10 ? (
                    <span>
                        <span style={{ color: 'var(--color-text-tertiary)' }}>{preText}</span>
                        <span style={{ margin: '0 2px' }}>→</span>
                        <span style={{ fontWeight: 'bold', color: evalColor }}>{postText}</span>
                    </span>
                ) : (
                    <span style={{ fontWeight: 'bold', color: evalColor }}>{postText}</span>
                )}
            </span>

            {/* Col 4: Text */}
            <span style={{
                color: 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center'
            }}>
                {classification !== 'none' && (
                    <span style={{
                        fontWeight: '600',
                        fontSize: '0.85em',
                        marginRight: '6px',
                        textTransform: 'capitalize',
                        color: labelColor
                    }}>
                        {classification}
                    </span>
                )}
                <span style={{ fontStyle: 'italic' }} title={displayText}>
                    [{truncatedText}]
                </span>
            </span>
        </div>
    );
};
