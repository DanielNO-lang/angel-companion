import React, { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { FRIENDLY_ERROR_MESSAGES, logSanitizedDiagnostic } from '../../services/errorHandlingService';

const LOADED_IMAGE_CACHE = new Set<string>();

export function deriveWebpPath(src: string): string | null {
  if (!src) return null;
  if (src.startsWith('/assets/showcase/') && src.endsWith('.png')) {
    return src.slice(0, -4) + '.webp';
  }
  return null;
}

interface SmartImageProps {
  src: string;
  alt: string;
  aspectRatioClass?: string;
  width?: number;
  height?: number;
  priority?: 'high' | 'normal';
  className?: string;
  imgClassName?: string;
  placeholderLabel?: string;
}

/**
 * Unified performant image component:
 * - Serves optimized WebP with PNG fallback via <picture>
 * - Lazy loads below-the-fold imagery unless priority="high"
 * - Reserves intrinsic aspect ratio to prevent layout shift (CLS = 0)
 * - Tracks loaded sources to avoid shimmer flash on revisit
 * - Provides graceful friendly error fallback
 */
export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  aspectRatioClass = '',
  width,
  height,
  priority = 'normal',
  className = '',
  imgClassName = '',
  placeholderLabel = 'Loading preview...',
}) => {
  const webpSrc = deriveWebpPath(src);
  const alreadyCached = LOADED_IMAGE_CACHE.has(src);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    alreadyCached ? 'loaded' : 'loading'
  );
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (LOADED_IMAGE_CACHE.has(src)) {
      setStatus('loaded');
      return;
    }
    setStatus('loading');
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      LOADED_IMAGE_CACHE.add(src);
      setStatus('loaded');
    }
  }, [src]);

  const handleLoad = () => {
    LOADED_IMAGE_CACHE.add(src);
    setStatus('loaded');
  };

  const handleError = () => {
    logSanitizedDiagnostic({
      category: 'media_failure',
      context: 'media',
      rawError: 'Media preview image failed to load',
      metadata: { src },
    });
    setStatus('error');
  };

  return (
    <div className={`relative overflow-hidden ${aspectRatioClass} ${className}`}>
      {status === 'loading' && (
        <div
          aria-hidden="true"
          className="absolute inset-0 skeleton-shimmer flex items-center justify-center"
        >
          <span className="text-[11px] font-mono text-slate-400/90 animate-pulse px-2 text-center">
            {placeholderLabel}
          </span>
        </div>
      )}

      {status === 'error' ? (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-slate-300 p-4 text-center"
        >
          <ImageOff className="w-5 h-5 text-cyan-400/80" />
          <span className="text-[11px] font-medium max-w-[220px] leading-snug">
            {FRIENDLY_ERROR_MESSAGES.MEDIA}
          </span>
        </div>
      ) : (
        <picture className="block w-full h-full">
          {webpSrc && <source srcSet={webpSrc} type="image/webp" />}
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading={priority === 'high' ? 'eager' : 'lazy'}
            fetchPriority={priority === 'high' ? 'high' : 'auto'}
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full transition-opacity duration-300 ${
              status === 'loaded' ? 'opacity-100' : 'opacity-0'
            } ${imgClassName}`}
          />
        </picture>
      )}
    </div>
  );
};
