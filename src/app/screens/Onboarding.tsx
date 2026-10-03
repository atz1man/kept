import { color, font, shadow } from '../../tokens';
import { Pressable } from '../components/Pressable';
import { Logo, Wordmark } from '../components/Icons';
import { isNative } from '../../lib/mirror';

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
    body: 'Paste an order email or photograph a till receipt, and Kept reads the store, the total and the date — then starts the clock for you.',
  },
  {
    title: 'Two clocks. We watch both.',
    body: 'The shop’s return window, and the statutory one running beside it. Kept counts both down and tells you which closes first, every time you open it.',
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
    native: 'The shop’s return window, and the statutory one running beside it. Kept counts both down, and if you allow notifications, lodges each deadline with iOS so it arrives at 9am on the day, even with Kept shut.',
  },
  {
    title: 'Your receipts stay yours.',
    body: 'No account. No cloud. Nothing uploaded. Policy updates download to your phone — your purchases never leave it.',
  },
] as const satisfies readonly { title: string; body: string; native?: string }[];

export const ONBOARDING_STEPS = STEPS.length;

interface Props {
  step: number;
  onNext: () => void;
  onSkip: () => void;
}

export function Onboarding({ step, onNext, onSkip }: Props) {
  const current: { title: string; body: string; native?: string } = STEPS[step] ?? STEPS[0];
  const body = isNative() && current.native ? current.native : current.body;
  return (
    <div className="k-fade" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 24px 40px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size={24} />
          <Wordmark size={20} />
        </div>
        <Pressable onClick={onSkip} style={{ width: 'auto', fontSize: 13, fontWeight: 700, color: color.muted, padding: 8 }}>
          Skip
        </Pressable>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            height: 190, borderRadius: 20, overflow: 'hidden',
            border: `1px solid ${color.border}`, boxShadow: shadow.raisedLg, marginBottom: 26,
          }}
        >
          <StepArt step={step} />
        </div>

        <h1 tabIndex={-1} style={{ fontFamily: font.display, fontSize: 28, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.6px', margin: 0 }}>
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
                background: i === step ? color.accent : 'rgba(20,22,26,0.18)', transition: 'all .25s',
              }}
            />
          ))}
        </div>
        <Pressable
          className="k-cta-yellow"
          onClick={onNext}
          style={{
            width: 'auto', padding: '15px 30px', background: color.accent, color: color.white, border: 0,
            borderRadius: 999, fontWeight: 700, fontSize: 15, boxShadow: shadow.raised,
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
function StepArt({ step }: { step: number }) {
  // The viewBox aspect deliberately matches the 190px-tall frame's own: with
  // `slice`, a squarer viewBox is scaled up to cover and the top and bottom of
  // the drawing are cropped away — which is how the first pass lost the tops
  // of the receipts.
  const common = { width: '100%', height: '100%', viewBox: '0 0 356 190', preserveAspectRatio: 'xMidYMid slice' } as const;
  const ticket = 'M8 1H32Q39 1 39 9V44L32.7 50 26.3 44 20 50 13.7 44 7.3 50 1 44V9Q1 1 8 1Z';

  if (step === 0) {
    // Receipts in a tidy stack: the pile, gathered.
    return (
      <svg {...common} role="img" aria-label="Receipts, gathered in one place">
        <rect width="356" height="190" fill={color.surfaceAlt} />
        {[
          { x: 70, y: 52, fill: color.white },
          { x: 138, y: 40, fill: color.white },
          { x: 206, y: 28, fill: color.accentSoft },
        ].map((t, i) => (
          <g key={i} transform={`translate(${t.x} ${t.y}) scale(1.9)`}>
            <path d={ticket} fill={t.fill} stroke={color.borderSoft} strokeWidth="0.8" />
            <path d="M9 13h22M9 20h22M9 27h13" stroke={color.muted} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
          </g>
        ))}
      </svg>
    );
  }

  if (step === 1) {
    // Two clocks, one further through its window than the other: the shop's
    // and the law's, which is the promise the screen is making.
    return (
      <svg {...common} role="img" aria-label="Two countdown clocks running side by side">
        <rect width="356" height="190" fill={color.surfaceAlt} />
        <g transform="translate(122 95)">
          <circle r="52" fill="none" stroke={color.white} strokeWidth="9" />
          <circle r="52" fill="none" stroke={color.accent} strokeWidth="9" strokeLinecap="round"
            strokeDasharray="327" strokeDashoffset="98" transform="rotate(-90)" />
          <path d="M0 -26V2l18 13" fill="none" stroke={color.ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g transform="translate(244 95)">
          <circle r="40" fill="none" stroke={color.white} strokeWidth="8" />
          <circle r="40" fill="none" stroke={color.danger} strokeWidth="8" strokeLinecap="round"
            strokeDasharray="251" strokeDashoffset="176" transform="rotate(-90)" />
          <path d="M0 -20V2l14 10" fill="none" stroke={color.ink} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }

  // A phone that keeps its own contents.
  return (
    <svg {...common} role="img" aria-label="A phone holding its receipts behind a lock">
      <rect width="356" height="190" fill={color.surfaceAlt} />
      <rect x="134" y="20" width="88" height="152" rx="18" fill={color.ink} />
      <rect x="141" y="27" width="74" height="138" rx="13" fill={color.canvas} />
      <g transform="translate(161 50) scale(0.85)">
        <path d={ticket} fill={color.accentSoft} stroke={color.borderSoft} strokeWidth="0.8" />
        <path d="M9 13h22M9 20h22M9 27h13" stroke={color.muted} strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      </g>
      <g transform="translate(161 111)">
        <rect x="4" y="14" width="30" height="22" rx="6" fill={color.ink} />
        <path d="M11 14V9a8 8 0 0116 0v5" fill="none" stroke={color.ink} strokeWidth="4" />
        <circle cx="19" cy="25" r="3.5" fill={color.accent} />
      </g>
      <path d="M44 62h44M44 78h28M268 108h44M282 124h28" stroke={color.fainter} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" />
    </svg>
  );
}
