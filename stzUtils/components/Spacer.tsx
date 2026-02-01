interface SpacerProps {
  space?: number
  orientation?: 'vertical' | 'horizontal'
}

export const Spacer = (props: SpacerProps) => {
  const { space = 1.5, orientation = 'vertical' } = props

  return orientation === 'vertical' ? (
    <hr
      style={{
        height: `${space}rem`,
        color: 'transparent',
        backgroundColor: 'transparent',
        margin: '0',
      }}
    />
  ) : (
    <div style={{ width: `${space}rem`, minWidth: `${space}rem`, flexShrink: 0 }} />
  )
}