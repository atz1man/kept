import { Component, type ErrorInfo, type ReactNode } from 'react';
import { color, font, radius } from '../../tokens';
import { embedded } from '../../lib/embed';
import { rescueBackup } from '../../lib/storage';
import { backupFilename, savedWhere, saveJsonFile } from '../../lib/save-file';

/**
 * What is on screen when the app cannot render.
 *
 * Without this, a throw anywhere below it unmounts the whole tree: measured,
 * and it is a blank page with no text and not one button, while the receipts
 * sit intact in localStorage with no server holding a copy. A reload recovers
 * only when the fault is on a screen you had to navigate to — a fault on the
 * first screen, or one caused by a particular stored receipt, lands straight
 * back in the blank state on every launch. The app has already had exactly
 * that shape of bug once, and it was fixed at the data layer; this is the
 * same fix at the render layer, for causes nobody has thought of yet.
 *
 * The rescue deliberately does NOT go through the app's own state, its
 * loader, or its receipt reader. Any of those may be what just threw. It
 * reads the store, copies it, and offers it as a file.
 *
 * A class component because that is the only thing React lets catch a render
 * error, and it is why this one file is not a hook.
 */
interface State {
  failed: boolean;
  /**
   * `done` was a claim, not an observation. It was set the moment the anchor
   * was clicked, and an anchor click reports nothing — so in the iOS app,
   * where WKWebView ignores the download attribute entirely, this screen told
   * somebody their receipts were saved while no file existed anywhere. On the
   * only screen in the app whose entire purpose is being believable about the
   * last copy of their data. The message now comes from what the write
   * returned; see save-file.ts.
   */
  saved: 'idle' | 'saving' | 'nothing' | { note: string; ok: boolean };
}

export class Recovery extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, saved: 'idle' };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Nowhere to send it — no server, and the privacy notice says nothing
    // leaves the device — so the console is the whole of the reporting. It is
    // still worth writing: it is what a person can copy into a bug report.
    console.error('kept could not render:', error, info.componentStack);
  }

  private rescue = async () => {
    const backup = rescueBackup();
    if (!backup) {
      this.setState({ saved: 'nothing' });
      return;
    }
    this.setState({ saved: 'saving' });
    const outcome = await saveJsonFile(backupFilename('rescue', new Date()), backup.text);
    this.setState({
      saved: { note: savedWhere(outcome), ok: outcome.to !== 'nowhere' },
    });
  };

  render() {
    if (!this.state.failed) return this.props.children;

    /*
     * The landing page's demo keeps nothing, so it has nothing to rescue. The
     * button read the real store all the same: a crash inside the demo handed
     * the visitor's own library over as a file, under a sentence about the
     * demo's samples. Measured: the file held the three real receipts. The
     * store refuses the demo now, which would leave the button reporting
     * nothing on this device to save, and that is false for anyone who uses
     * kept. So the demo says what is true of it, and offers nothing.
     */
    const demo = embedded();

    return (
      <main
        style={{
          minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 14, padding: '28px 22px', background: color.canvas, color: color.ink,
          fontFamily: font.ui,
        }}
      >
        <h1 tabIndex={-1} style={{ fontFamily: font.display, fontSize: 26, fontWeight: 600, margin: 0 }}>
          Something in kept broke
        </h1>
        {demo ? (
          <p style={{ fontSize: 14.5, lineHeight: 1.55, color: color.body, margin: 0 }}>
            This is the demo. It keeps nothing, so nothing has been lost, and the receipts you keep in kept itself are
            not touched by it.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: color.body, margin: 0 }}>
              Your receipts are still on this device and nothing has been deleted. Save a copy before anything else — kept
              keeps them here and nowhere else, so a file on your phone is the only backup there is.
            </p>
            <button className="k-primary"
              type="button"
              onClick={() => void this.rescue()}
              style={{
                padding: '14px 18px', borderRadius: radius.control, border: 0,
                background: color.accent, color: color.white, fontWeight: 600, fontSize: 14.5, cursor: 'pointer',
              }}
            >
              Save my receipts to a file
            </button>
          </>
        )}
        {typeof this.state.saved === 'object' && (
          <p
            role="status"
            style={{
              fontSize: 13.5,
              color: this.state.saved.ok ? color.body : color.danger,
              margin: 0,
            }}
          >
            {this.state.saved.note}
            {this.state.saved.ok ? (
              <>
                {' '}
                You can bring it back with <strong>Restore from a backup</strong> in Settings.
              </>
            ) : null}
          </p>
        )}
        {this.state.saved === 'nothing' && (
          <p role="status" style={{ fontSize: 13.5, color: color.body, margin: 0 }}>
            There was nothing stored on this device to save.
          </p>
        )}
        <button className="k-secondary"
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '13px 18px', borderRadius: radius.control, border: `1px solid ${color.border}`,
            background: color.white, color: color.ink, fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </main>
    );
  }
}
