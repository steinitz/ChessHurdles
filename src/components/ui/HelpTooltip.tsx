import React, { useState, useRef, useEffect } from 'react';

interface HelpTooltipProps {
  content: React.ReactNode;
}

export function HelpTooltip({ content }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const toggleVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(!isVisible);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isVisible]);

  return (
    <div
      className="help-tooltip-container"
      style={{ display: 'inline-block', position: 'relative', marginLeft: '8px', verticalAlign: 'middle' }}
      ref={tooltipRef}
    >
      <button
        onClick={toggleVisibility}
        style={{
          background: '#e0e0e0',
          color: '#555',
          borderRadius: '50%',
          width: '18px',
          height: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1
        }}
        aria-label="Show help"
        title="Click for help"
      >
        ?
      </button>

      {isVisible && (
        <div
          style={{
            position: 'absolute',
            bottom: '125%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '250px',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-bg-secondary)',
            padding: '10px',
            borderRadius: 'var(--border-radius)',
            fontSize: '13px',
            lineHeight: '1.4',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            textAlign: 'left'
          }}
        >
          {content}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              marginLeft: '-5px',
              borderWidth: '5px',
              borderStyle: 'solid',
              borderColor: 'var(--color-bg-secondary) transparent transparent transparent'
            }}
          />
        </div>
      )}
    </div>
  );
}
