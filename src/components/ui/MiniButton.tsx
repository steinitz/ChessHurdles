import React from 'react';

interface MiniButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // Add any specific props if needed
}

export const MiniButton: React.FC<MiniButtonProps> = ({ style, children, ...props }) => {
  return (
    <button
      style={{
        padding: '2px 8px',
        fontSize: '0.8rem',
        cursor: 'pointer',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
};
