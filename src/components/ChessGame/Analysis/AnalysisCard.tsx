import React from 'react';
import type { AnalysisDisplayItem } from './analysis-formatter';

export interface AnalysisCardProps {
    item: AnalysisDisplayItem;
    onClick: () => void;
    isActive?: boolean;
    onDelete?: (e: React.MouseEvent) => void;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ item, onClick, isActive, onDelete }) => {
    const [isHovered, setIsHovered] = React.useState(false);
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
        displayText = `Best: ${item.pv} `;
    } else if (item.bestMove && item.bestMove !== '?') {
        displayText = `Best: ${item.bestMove} `;
    }

    // Truncate
    const truncatedText = displayText.length > 60 ? displayText.slice(0, 60) + '...' : displayText;

    const labelColor = classification === 'blunder' ? 'var(--color-error)'
        : classification === 'mistake' ? 'var(--color-text)'
            : 'var(--color-text-secondary)';

    // Dynamic Backgrounds using variables (with opacity via color-mix if supported, or fallbacks)
    // Since we want to avoid hardcoded colors and support themes, uses CSS variables directly where possible.
    // For backgrounds, we might need to rely on the fact that variables like --color-error usually contrast with --color-bg.
    // However, widely supported `rgba` with variables isn't standard CSS syntax (e.g. rgba(var(--color), 0.1)).
    // MVP.css usually defines --color-bg-secondary.
    // PROPOSAL: Use borders to indicate classification instead of backgrounds to be safe with themes?
    // User requested avoiding hardcoded backgrounds.
    // Let's stick to the subtle left border and standard hover background.

    const baseStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: onDelete ? '40px 60px 80px 1fr 30px' : '40px 60px 80px 1fr',
        gap: '8px',
        alignItems: 'center',
        padding: '6px 8px',
        borderBottom: '1px solid var(--color-bg-secondary)',
        fontSize: '0.9em',
        cursor: 'pointer',
        lineHeight: '1.4',
        transition: 'background-color 0.2s',
        backgroundColor: isActive ? 'var(--color-bg-secondary)' : isHovered ? 'var(--color-bg-secondary)' : 'transparent',
    };

    // Classification specific styles (Left Border)
    if (classification === 'blunder') {
        baseStyle.borderLeft = '4px solid var(--color-error)';
        // Optional: faint background if we can derive it safely. For now, trust the border.
    } else if (classification === 'mistake') {
        baseStyle.borderLeft = '4px solid var(--color-text)';
    } else if (classification === 'inaccuracy') {
        baseStyle.borderLeft = '4px solid var(--color-text-secondary)';
    } else if (isActive) {
        baseStyle.borderLeft = '4px solid var(--color-link)';
    } else {
        baseStyle.borderLeft = '4px solid transparent';
    }

    return (
        <div
            style={baseStyle}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
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

            {/* Optional Col 5: Delete Button */}
            {onDelete && (
                <button
                    onClick={onDelete}
                    title="Delete"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-error)',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: isHovered ? 1 : 0,
                        transition: 'opacity 0.2s, transform 0.1s',
                        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                        minWidth: 'unset',
                        height: '100%'
                    }}
                >
                    ✕
                </button>
            )}
        </div>
    );
};
