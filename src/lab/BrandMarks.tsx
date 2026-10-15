/**
 * Brand identity marks used on the Home cards and inside each experience.
 * Madfu uses the official wordmark from madfu.com.sa (public/madfu-wordmark.svg, unaltered paths).
 * Tabby and Tamara are shown as neutral text wordmarks in their brand colours: no third-party
 * logo files are copied into this prototype.
 */

export function MadfuWordmark({ height = 22, white = false, title = 'Madfu' }: { height?: number; white?: boolean; title?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}${white ? 'madfu-wordmark-white.svg' : 'madfu-wordmark.svg'}`}
      alt={title}
      height={height}
      style={{ height, width: 'auto' }}
    />
  );
}

/** "madfu | Business" lockup for the proposed merchant product. The core logo is not modified. */
export function MadfuBusinessLockup({ height = 24, inverse = false }: { height?: number; inverse?: boolean }) {
  return (
    <span className={`mb-lockup ${inverse ? 'is-inverse' : ''}`} aria-label="Madfu Business">
      <MadfuWordmark height={height} white={inverse} title="" />
      <span className="mb-lockup-rule" aria-hidden="true" />
      <span className="mb-lockup-business" aria-hidden="true">Business</span>
    </span>
  );
}

export function TabbyMark({ size = 22 }: { size?: number }) {
  return (
    <span className="brand-text brand-tabby" style={{ fontSize: size }} aria-label="Tabby">
      tabby
    </span>
  );
}

export function TamaraMark({ size = 22 }: { size?: number }) {
  return (
    <span className="brand-text brand-tamara" style={{ fontSize: size }} aria-label="Tamara">
      tamara
    </span>
  );
}
