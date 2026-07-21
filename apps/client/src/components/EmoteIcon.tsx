/** 自制局内表情 SVG（LRM-177；非腾讯版权资产）。 */
import type { SocialEmoteId } from '@card-game/rules';

const LABELS: Record<SocialEmoteId, string> = {
  like: '点赞',
  handshake: '握手',
  surprise: '惊讶',
  cry: '流泪',
  angry: '愤怒',
  smug: '得意',
};

export function emoteLabel(id: SocialEmoteId): string {
  return LABELS[id];
}

export function EmoteIcon({ id, className }: { id: SocialEmoteId; className?: string }) {
  const common = {
    className: className ?? 'emote-icon',
    viewBox: '0 0 48 48',
    'aria-hidden': true as const,
  };
  switch (id) {
    case 'like':
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="22" fill="#2f6fed" />
          <path
            d="M18 22v12h-4V22h4zm4 12V20.5c0-2 1.2-3.5 3.2-3.5.8 0 1.5.2 1.8.5V16c0-1.8 1.3-3 3.1-3 1.7 0 3.1 1.3 3.1 3v14.2l3.2-.3c1.4-.1 2.6 1 2.6 2.4 0 .6-.2 1.1-.6 1.5l-4.8 5.2c-.5.5-1.2.8-1.9.8H22z"
            fill="#fff"
          />
        </svg>
      );
    case 'handshake':
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="22" fill="#1a9b6c" />
          <path
            d="M10 26c2-4 6-6 10-5l4 3 4-3c4-1 8 1 10 5l-5 4c-1-1-3-2-5-1l-4 3-4-3c-2-1-4 0-5 1l-5-4z"
            fill="#fff"
          />
          <path d="M18 28l6 5 6-5" stroke="#0f6b4a" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'surprise':
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="22" fill="#ca8a04" />
          <circle cx="17" cy="20" r="3" fill="#fff" />
          <circle cx="31" cy="20" r="3" fill="#fff" />
          <ellipse cx="24" cy="32" rx="5" ry="7" fill="#fff" />
        </svg>
      );
    case 'cry':
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="22" fill="#0ea5e9" />
          <path d="M14 18c2 2 5 2 7 0" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M27 18c2 2 5 2 7 0" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M17 28c2 5 12 5 14 0" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M14 22v8M34 22v8" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'angry':
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="22" fill="#dc2626" />
          <path d="M12 16l8 4M36 16l-8 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="17" cy="23" r="2.5" fill="#fff" />
          <circle cx="31" cy="23" r="2.5" fill="#fff" />
          <path d="M16 34c3-4 13-4 16 0" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'smug':
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="22" fill="#8b5cf6" />
          <path d="M14 22c2-3 5-3 7 0M27 22c2-3 5-3 7 0" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M16 30c3 5 13 5 16 0" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="34" cy="14" r="3" fill="#fbbf24" />
        </svg>
      );
    default:
      return null;
  }
}
