import { color, font, shadow, radius } from '../../tokens';
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
        <Pressable onClick={onSkip} style={{ width: 'auto', fontSize: 13, fontWeight: 600, color: color.muted, padding: 8 }}>
          Skip
        </Pressable>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            height: 190, borderRadius: 16, overflow: 'hidden',
            border: `1px solid ${color.borderHair}`, marginBottom: 26,
          }}
        >
          <StepArt step={step} />
        </div>

        <h1 tabIndex={-1} style={{ fontFamily: font.display, fontSize: 28, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.6px', margin: 0 }}>
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
function StepArt({ step }: { step: number }) {
  // The viewBox aspect deliberately matches the 190px-tall frame's own: with
  // `slice`, a squarer viewBox is scaled up to cover and the top and bottom of
  // the drawing are cropped away — which is how the first pass lost the tops
  // of the receipts.
  const common = { width: '100%', height: '100%', viewBox: '0 0 356 190', preserveAspectRatio: 'xMidYMid slice' } as const;
  // Drawn as the product rather than as cartoons: miniature rows, rings and
  // a phone in the app's own thin lines and colours. The first pass drew
  // chunky tickets and clock hands, which read as a children's app.
  const row = (y: number, days: string, urgent: boolean) => (
    <g transform={`translate(60 ${y})`}>
      <rect width="236" height="38" rx="9" fill={color.white} stroke={color.borderHair} />
      <rect x="9" y="8" width="22" height="22" rx="6" fill={color.surfaceAlt} />
      <rect x="40" y="11" width="58" height="6" rx="3" fill={color.ink} opacity="0.75" />
      <rect x="40" y="22" width="92" height="5" rx="2.5" fill={color.muted} opacity="0.35" />
      <rect x="190" y="11" width="36" height="6" rx="3" fill={color.ink} opacity="0.75" />
      <text x="226" y="29" textAnchor="end" fontSize="8.5" fontWeight="600" fill={urgent ? color.danger : color.muted} fontFamily="Instrument Sans, sans-serif">{days}</text>
    </g>
  );

  if (step === 0) {
    // Receipts, gathered into one list.
    return (
      <svg {...common} role="img" aria-label="Receipts, gathered in one place">
        <rect width="356" height="190" fill={color.surfaceAlt} />
        {row(34, '2 days left', true)}
        {row(78, '9 days left', false)}
        {row(122, '21 days left', false)}
      </svg>
    );
  }

  if (step === 1) {
    // Two clocks, one further through its window than the other: the shop's
    // and the law's, which is the promise the screen is making.
    const ring = (x: number, label: string, days: string, offset: number, stroke: string) => (
      <g transform={`translate(${x} 86)`}>
        <circle r="38" fill={color.white} stroke={color.borderHair} strokeWidth="5" />
        <circle r="38" fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round"
          strokeDasharray="239" strokeDashoffset={offset} transform="rotate(-90)" />
        <text y="6" textAnchor="middle" fontSize="19" fontWeight="600" fill={color.ink} fontFamily="Instrument Sans, sans-serif">{days}</text>
        <text y="64" textAnchor="middle" fontSize="10" fontWeight="500" fill={color.muted} fontFamily="Instrument Sans, sans-serif">{label}</text>
      </g>
    );
    return (
      <svg {...common} role="img" aria-label="Two countdown clocks running side by side">
        <rect width="356" height="190" fill={color.surfaceAlt} />
        {ring(124, 'The shop’s window', '2', 205, color.danger)}
        {ring(232, 'Your legal right', '18', 96, color.accent)}
      </svg>
    );
  }

  // A phone that keeps its own contents.
  return (
    <svg {...common} role="img" aria-label="A phone holding its receipts behind a lock">
      <rect width="356" height="190" fill={color.surfaceAlt} />
      <rect x="136" y="22" width="84" height="146" rx="16" fill={color.white} stroke={color.borderSoft} strokeWidth="1.2" />
      <rect x="165" y="30" width="26" height="4" rx="2" fill={color.borderSoft} />
      <circle cx="178" cy="95" r="24" fill={color.accentSoft} />
      <rect x="168" y="94" width="20" height="15" rx="3.5" fill="none" stroke={color.accent} strokeWidth="1.8" />
      <path d="M172 94v-4a6 6 0 0112 0v4" fill="none" stroke={color.accent} strokeWidth="1.8" />
      <rect x="152" y="134" width="52" height="5" rx="2.5" fill={color.muted} opacity="0.35" />
      <rect x="160" y="145" width="36" height="5" rx="2.5" fill={color.muted} opacity="0.25" />
    </svg>
  );
}
