import { color, font, gradient, shadow, radius } from '../../tokens';
import { Pressable } from '../components/Pressable';
import { Logo, Wordmark } from '../components/Icons';
import { Avatar } from '../components/Avatar';
import { isNative } from '../../lib/mirror';
import { FEED_ORIGIN, feedRefreshes } from '../../lib/feed-origin';

/*
 * The first thing anyone reads, so it had better be true — and two of these
 * three were not.
 *
 * "or snap the paper slip" was here before scanning was built, while the add
 * screen showed a disabled button with a SOON chip. It came out, and went back
 * in once the camera really did read a till receipt, on the phone. Now it is
 * held to the code by `first-impressions.test.ts`: it names the camera only
 * while the app can read a photo.
 *
 * "You get pinged before either runs out": alerts are computed when kept is
 * opened or brought back to the foreground. A web app cannot wake itself —
 * notify.ts says so, and the Settings screen says so. This said otherwise.
 */
const STEPS = [
  {
    title: 'Every receipt, remembered.',
    body: 'Paste an order email or photograph a till receipt, and Quids In reads the store, the total and the date — then starts the clock for you.',
  },
  {
    title: 'Two clocks. We watch both.',
    body: 'The shop’s return window, and the statutory one running beside it. Quids In counts both down and tells you which closes first, every time you open it.',
    /*
     * The iPhone app does more than the sentence above, and the first screens
     * are where it should say so: reminders are lodged with iOS in advance and
     * arrive at 9am with Kept closed (schedule-native.ts). "If you allow
     * notifications" because iOS asks, and a person can say no. Worded as
     * Settings words it on iOS ("lodged with iOS … arrive at 9am"), the
     * register `alert-claims.test.ts` accepts: it names the mechanism and the
     * moment instead of promising a ping. Leaving the web sentence up here
     * would be the app understating itself, the same untruth notify.ts refuses.
     */
    native: 'The shop’s return window, and the statutory one running beside it. Quids In counts both down, and if you allow notifications, lodges each deadline with iOS so it arrives at 9am on the day, even with Quids In shut.',
  },
  {
    title: 'Your receipts stay yours.',
    body: 'No account. No cloud. Nothing uploaded. Policy updates download to your phone — your purchases never leave it.',
    /*
     * Where the app fetches no feed — the iPhone app until its build names a
     * host (lib/feed-origin.ts) — "download to your phone" is untrue: the
     * list it has is the one it shipped with, and a newer one arrives with
     * the next version of the app.
     */
    bundledFeed: 'No account. No cloud. Nothing uploaded. The list of policy changes comes with app updates — your purchases never leave your phone.',
  },
] as const satisfies readonly { title: string; body: string; native?: string; bundledFeed?: string }[];

export const ONBOARDING_STEPS = STEPS.length;

interface Props {
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

export function Onboarding({ step, onNext, onSkip }: Props) {
  const current: { title: string; body: string; native?: string; bundledFeed?: string } = STEPS[step] ?? STEPS[0];
  const native = isNative();
  const body =
    !feedRefreshes(native, FEED_ORIGIN) && current.bundledFeed
      ? current.bundledFeed
      : native && current.native
        ? current.native
        : current.body;
  return (
    <div className="k-fade" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 24px 40px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size={24} />
          <Wordmark size={20} />
        </div>
        <Pressable onClick={onSkip} style={{ width: 'auto', fontSize: 13, fontWeight: 600, color: color.muted, padding: 8 }}>
          Skip
        </Pressable>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ height: 190, borderRadius: radius.cardLg, overflow: 'hidden', marginBottom: 26, background: color.surfaceAlt }}>
          {step === 0 ? <FirstArt /> : <StepArt step={step} />}
        </div>

        <h1 tabIndex={-1} style={{ fontFamily: font.display, fontSize: 30, fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.03em', margin: 0 }}>
          {current.title}
        </h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, color: color.body, marginTop: 14, marginBottom: 0 }}>{body}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {/* A bare <div aria-label> is prohibited — no role, nothing to name.
            These dots are literally progress, so they say that. */}
        <div
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-valuetext={`Step ${step + 1} of ${STEPS.length}`}
          style={{ display: 'flex', gap: 6 }}
        >
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === step ? 22 : 8, height: 8, borderRadius: 999,
                background: i === step ? color.accent : 'rgba(10,10,18,0.18)', transition: 'all .25s',
              }}
            />
          ))}
        </div>
        <Pressable
          className="k-primary"
          onClick={onNext}
          style={{
            width: 'auto', padding: '15px 30px', background: color.accent, color: color.white, border: 0,
            borderRadius: radius.control, fontWeight: 600, fontSize: 15, boxShadow: shadow.raised,
          }}
        >
          {step === STEPS.length - 1 ? 'Let’s go' : 'Next'}
        </Pressable>
      </div>
    </div>
  );
}

/**
 * Drawn, not photographed.
 *
 * The prototype left three empty photo slots here for stock imagery. Shipping
 * an app whose first screen is a grey "drop a photo" box is worse than
 * shipping one that draws its own idea, and these are built from the brand's
 * own ticket-and-line-work vocabulary, so they read as finished rather than
 * as a placeholder waiting for a photographer. Swap in real photography by
 * replacing this component; nothing else changes.
 */
/**
 * The first screen's picture is the product itself, at small scale: the
 * balance the home screen opens on, and two rows of the list beneath it —
 * built from the same pieces, so it can never drift from what the app looks
 * like. HTML rather than an SVG drawing because it carries words, and the
 * contrast sweep measures words against the colour declared behind them:
 * the card declares the gradient's lightest stop, as the real one does.
 */
function FirstArt() {
  const row = (store: string, cat: 'audio' | 'kitchen', item: string, amount: string, days: string, urgent: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: color.white, borderRadius: 14, padding: '7px 10px' }}>
      <Avatar store={store} cat={cat} size={26} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 650, lineHeight: 1.2 }}>{store}</div>
        <div style={{ fontSize: 10, color: color.muted, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: font.figures, fontSize: 11.5, fontWeight: 700, lineHeight: 1.2 }}>{amount}</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: urgent ? color.danger : color.muted, lineHeight: 1.2 }}>{days}</div>
      </div>
    </div>
  );
  return (
    <div role="img" aria-label="Receipts gathered in one place, with what is still returnable at the top" style={{ height: '100%', boxSizing: 'border-box', padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div aria-hidden="true" style={{ backgroundColor: color.heroEnd, backgroundImage: gradient.hero, color: color.white, borderRadius: 16, padding: '10px 13px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: color.onHeroSoft }}>Still returnable</div>
        <div style={{ fontFamily: font.figures, fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
          £153<span style={{ fontSize: 15 }}>.99</span>
        </div>
      </div>
      <div aria-hidden="true">{row('Currys', 'audio', 'Headphones', '£89.00', '2 days left', true)}</div>
      <div aria-hidden="true">{row('Argos', 'kitchen', 'Stand mixer', '£64.99', '9 days left', false)}</div>
    </div>
  );
}

function StepArt({ step }: { step: number }) {
  // The viewBox aspect deliberately matches the 190px-tall frame's own: with
  // `slice`, a squarer viewBox is scaled up to cover and the top and bottom of
  // the drawing are cropped away — which is how the first pass lost the tops
  // of the receipts.
  const common = { width: '100%', height: '100%', viewBox: '0 0 356 190', preserveAspectRatio: 'xMidYMid slice' } as const;
  if (step === 1) {
    // Two clocks, one further through its window than the other: the shop's
    // and the law's, which is the promise the screen is making.
    const ring = (x: number, label: string, days: string, offset: number, stroke: string) => (
      <g transform={`translate(${x} 86)`}>
        <circle r="38" fill={color.white} stroke={color.surfaceDeep} strokeWidth="7" />
        <circle r="38" fill="none" stroke={stroke} strokeWidth="7" strokeLinecap="round"
          strokeDasharray="239" strokeDashoffset={offset} transform="rotate(-90)" />
        <text y="7" textAnchor="middle" fontSize="22" fontWeight="700" fill={stroke} fontFamily={font.figures}>{days}</text>
        <text y="64" textAnchor="middle" fontSize="10" fontWeight="500" fill={color.muted} fontFamily={font.ui}>{label}</text>
      </g>
    );
    return (
      <svg {...common} role="img" aria-label="Two countdown clocks running side by side">
        {ring(124, 'The shop’s window', '2', 205, color.danger)}
        {ring(232, 'Your legal right', '18', 96, color.accent)}
      </svg>
    );
  }

  // A phone that keeps its own contents: the app's balance on its screen,
  // behind a lock. Shapes only on the gradient — words there would be text
  // the contrast sweep measures against the page, not the paint.
  return (
    <svg {...common} role="img" aria-label="A phone holding its receipts behind a lock">
      <defs>
        <linearGradient id="ob-hero" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color.heroTop} />
          <stop offset="0.58" stopColor={color.heroMid} />
          <stop offset="1" stopColor={color.heroEnd} />
        </linearGradient>
      </defs>
      <rect x="128" y="16" width="100" height="160" rx="20" fill={color.white} stroke={color.borderSoft} strokeWidth="1.2" />
      <rect x="166" y="23" width="24" height="4" rx="2" fill={color.borderSoft} />
      <rect x="137" y="36" width="82" height="50" rx="11" fill="url(#ob-hero)" />
      <rect x="145" y="46" width="30" height="4" rx="2" fill={color.white} opacity="0.7" />
      <rect x="145" y="56" width="46" height="10" rx="3" fill={color.white} />
      <rect x="145" y="72" width="22" height="6" rx="3" fill={color.white} opacity="0.35" />
      <circle cx="178" cy="120" r="21" fill={color.accentSoft} />
      <rect x="169" y="119" width="18" height="14" rx="3.5" fill="none" stroke={color.accent} strokeWidth="1.8" />
      <path d="M172.5 119v-4a5.5 5.5 0 0111 0v4" fill="none" stroke={color.accent} strokeWidth="1.8" />
      <rect x="152" y="152" width="52" height="5" rx="2.5" fill={color.muted} opacity="0.3" />
    </svg>
  );
}
