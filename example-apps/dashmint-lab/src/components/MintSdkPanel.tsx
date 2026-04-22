/**
 * SDK call preview panel for the mint form.
 * Shows a syntax-highlighted code block that reflects live form values.
 */

interface MintSdkPanelProps {
  name: string
  description: string
}

function Kw({ children }: { children: string }) {
  return <span className="text-ink">{children}</span>
}
function Fn({ children }: { children: string }) {
  return <span className="text-accent">{children}</span>
}
function Str({ children }: { children: string }) {
  return <span style={{ color: 'var(--color-syntax-green)' }}>{children}</span>
}
function Cmt({ children }: { children: string }) {
  return <span className="text-ink-4">{children}</span>
}
function Num({ children }: { children: string }) {
  return <span className="text-rarity-rare">{children}</span>
}

export function MintSdkPanel({ name, description }: MintSdkPanelProps) {
  const nameDisplay = name || 'Card Name'
  const descDisplay = description || 'A short description'

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4">
      {/* Eyebrow */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
          SDK Call
        </span>
        <span className="font-mono text-[10.5px] text-ink-4">
          src/dash/mintCard.ts
        </span>
      </div>

      {/* Code block */}
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-bg p-3 font-mono text-[11.5px] leading-[1.6] text-ink-2">
        <Cmt>{'// Create a new card document'}</Cmt>{'\n'}
        <Kw>{'await'}</Kw>{' sdk.documents.'}<Fn>{'create'}</Fn>{'({'}{'\n'}
        {'  document: {'}{'\n'}
        {'    name: '}<Str>{`"${nameDisplay}"`}</Str>{','}{'\n'}
        {'    description: '}<Str>{`"${descDisplay}"`}</Str>{','}{'\n'}
        {'    attack: '}<Cmt>{'rand'}</Cmt>{'('}<Num>{'1'}</Num>{', '}<Num>{'10'}</Num>{'),'}{'\n'}
        {'    defense: '}<Cmt>{'rand'}</Cmt>{'('}<Num>{'1'}</Num>{', '}<Num>{'10'}</Num>{'),'}{'\n'}
        {'  },'}{'\n'}
        {'  identityKey, signer'}{'\n'}
        {'});'}
      </pre>

      {/* Footer links */}
      <p className="text-[11px] text-ink-4">
        See{' '}
        <span className="font-mono text-ink-3">mintCard.ts</span>
        {' and '}
        <span className="font-mono text-ink-3">StarterPack.tsx</span>
        {' for the full implementation.'}
      </p>
    </div>
  )
}
