import { useState, useRef, memo } from 'react';
import { ChevronRight, ChevronLeft, EyeIcon } from './Icons.jsx';
import { OUT_BEHAVIORS } from '../styles/theme.js';

/** Build thumbnail URL via the Preview Server snapshot proxy. */
function thumbSrc(payloadUri) {
  if (!payloadUri) return '';
  return `/api/thumb?payloadUrl=${encodeURIComponent(payloadUri)}`;
}

export default memo(function GraphicBadge({ gfx, isSelected, isOnAir = false, showHandler = true, showContinuePoints = true, showContinueButton = false, showThumbnails = true, onTakeIn, onTakeOut, onContinue, handlerColor }) {
  const outBehavior = OUT_BEHAVIORS[gfx.graphicType] || OUT_BEHAVIORS[''];
  const [showThumb, setShowThumb] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const badgeRef = useRef(null);

  // TODO: Re-enable once Preview Server thumbnails are tested on-network
  const hasThumb = false && showThumbnails && !!gfx.payloadUri && !thumbError;

  // Badge color: use configured handler color if provided, otherwise fall back to hardcoded defaults
  const badgeColor = handlerColor ?? (
    gfx.handlerName === 'WALL' ? '#d0b34b'
    : gfx.handlerName?.startsWith('WALL_') ? '#ff8080'
    : '#f7dd72'
  );

  return (
    <div ref={badgeRef} style={{
      padding: '8px 10px', borderRadius: 6,
      border: isOnAir ? '2px solid #e53935' : isSelected ? '2px solid var(--accent)' : '2px solid var(--border)',
      outline: isOnAir && isSelected ? '2px solid var(--accent)' : 'none',
      outlineOffset: '-5px',
      background: isOnAir ? 'rgba(229,57,53,0.08)' : isSelected ? 'var(--surface-hover)' : 'var(--surface)',
      transition: 'all 0.1s', cursor: 'pointer',
      position: 'relative',
    }}>
      {/* Slug — full text, never truncated */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 5, wordBreak: 'break-word' }}>
        {gfx.slug || '(no slug)'}
      </div>

      {/* Badges and controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {/* Out behavior badge */}
          {gfx.graphicType === '' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, height: 18, borderRadius: 3, background: badgeColor, padding: '0 4px', fontSize: 9, fontWeight: 700, color: '#000' }} title={outBehavior.desc}>
              {gfx.tcDur || '—'}
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', width: 32, height: 18, borderRadius: 3, background: badgeColor, padding: '0 3px' }} title={outBehavior.desc}>
              {gfx.graphicType === 'STORYEND' && <svg width="8" height="8"><rect width="8" height="8" fill="#000" /></svg>}
              {gfx.graphicType === 'BACKGROUNDEND' && <svg width="8" height="8"><rect x="0.5" y="0.5" width="7" height="7" fill="none" stroke="#000" strokeWidth="1" /></svg>}
              {gfx.graphicType === 'MANUAL' && <svg width="9" height="8"><line x1="0" y1="1" x2="9" y2="1" stroke="#000" strokeWidth="1.5" /><line x1="0" y1="4" x2="9" y2="4" stroke="#000" strokeWidth="1.5" /><line x1="0" y1="7" x2="9" y2="7" stroke="#000" strokeWidth="1.5" /></svg>}
            </span>
          )}

          {/* Handler */}
          {showHandler && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 3, background: 'var(--handler-bg)', color: 'var(--handler-text)' }}>
              {gfx.handlerName}
            </span>
          )}

          {/* Continue button */}
          {showContinueButton && gfx.continueCount > 0 && (
            <button onClick={(e) => { e.stopPropagation(); onContinue(); }}
              style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3, border: 'none', background: 'var(--accent)', color: '#000', cursor: 'pointer', fontFamily: 'inherit' }}
              title="Continue (PgDn)">
              CONT
            </button>
          )}

          {/* Continue count */}
          {showContinuePoints && gfx.continueCount > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: 2, padding: '1px 3px' }}>
              ▶{gfx.continueCount}
            </span>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {/* Thumbnail preview button */}
          {hasThumb && (
            <button
              onMouseEnter={() => setShowThumb(true)}
              onMouseLeave={() => setShowThumb(false)}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 4,
                width: 28, height: 24, cursor: 'pointer', color: 'var(--text-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Preview thumbnail">
              <EyeIcon />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onTakeOut(gfx.id); }}
            style={{ background: 'var(--btn-take-out)', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 11, fontWeight: 600, fontFamily: 'inherit', minWidth: 52 }}
            title="Take Out (←)">
            <ChevronLeft /> OUT
          </button>
          <button onClick={(e) => { e.stopPropagation(); onTakeIn(gfx.id); }}
            style={{ background: 'var(--btn-take-in)', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 11, fontWeight: 600, fontFamily: 'inherit', minWidth: 52 }}
            title="Take In (→)">
            <ChevronRight /> IN
          </button>
        </div>
      </div>

      {/* Thumbnail popup */}
      {showThumb && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 8, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
          padding: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          <img
            src={thumbSrc(gfx.payloadUri)}
            alt={gfx.slug}
            onError={() => { setThumbError(true); setShowThumb(false); }}
            style={{ display: 'block', maxWidth: 320, maxHeight: 200, borderRadius: 4 }}
          />
        </div>
      )}
    </div>
  );
})
