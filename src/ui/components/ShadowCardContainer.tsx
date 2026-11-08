import React, { useEffect, useRef } from 'react';

export interface ShadowCardContainerProps {
  html: string;
  css?: string;
  className?: string;
  onAudioPlay?: (src: string) => void;
}

/**
 * Isolates flashcard HTML and template CSS inside a Shadow DOM container.
 * This guarantees that custom styling, imported Anki stylesheets, and responsive
 * card formatting cannot leak out into the main application UI shell, and vice versa.
 */
export const ShadowCardContainer: React.FC<ShadowCardContainerProps> = ({
  html,
  css = '',
  className = '',
  onAudioPlay,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    // Guard against re-attaching a shadow root if one already exists on the element (e.g. during React StrictMode)
    if (!shadowRootRef.current) {
      shadowRootRef.current = hostRef.current.shadowRoot ?? hostRef.current.attachShadow({ mode: 'open' });
    }

    const shadow = shadowRootRef.current;

    // Base CSS reset to protect card isolation
    const baseStyle = `
      :host {
        display: block;
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: inherit;
        line-height: 1.5;
        box-sizing: border-box;
      }
      *, *::before, *::after {
        box-sizing: inherit;
      }
      img {
        max-width: 100%;
        height: auto;
        display: inline-block;
      }
      hr#answer {
        border: 0;
        border-top: 1px solid rgba(128, 128, 128, 0.35);
        margin: 1.5rem 0;
      }
      .cloze {
        font-weight: 700;
        color: #007aff;
      }
    `;

    // Render contents inside Shadow DOM
    shadow.innerHTML = `
      <style>
        ${baseStyle}
        ${css}
      </style>
      <div class="card-body">
        ${html}
      </div>
    `;

    // Intercept audio elements if onAudioPlay callback is provided
    if (onAudioPlay) {
      const audioElements = shadow.querySelectorAll<HTMLAudioElement>('audio');
      audioElements.forEach((audio) => {
        audio.addEventListener('play', () => {
          if (audio.src) onAudioPlay(audio.src);
        });
      });
    }

    // Cleanup: pause any playing media when the card changes or unmounts
    return () => {
      if (shadowRootRef.current) {
        const audioElements = shadowRootRef.current.querySelectorAll<HTMLAudioElement>('audio');
        audioElements.forEach((audio) => {
          audio.pause();
        });
      }
    };
  }, [html, css, onAudioPlay]);

  return <div ref={hostRef} className={`shadow-card-wrapper ${className}`} />;
};
