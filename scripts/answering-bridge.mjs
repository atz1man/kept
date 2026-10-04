/**
 * A native bridge that ANSWERS, for the flows that need a camera or a disk.
 *
 * Shared by the sweeps that boot the iOS bundle as native and need replies:
 * ios-bundle.mjs (scan, reminders, the slow-mirror rescue) and
 * store-screenshots.mjs (the scan shot). One copy, so the two cannot come to
 * disagree about what a phone says back.
 *
 * Capacitor's own core calls native through `PluginHeaders` and
 * `nativePromise`, so declaring Camera and Filesystem there and answering them
 * exercises the app's real plugin imports. The disk lives in sessionStorage so
 * it survives a reload, as a phone's Documents directory does; `slowMirrorMs`
 * delays reading the library's mirror file, as a slow disk would.
 */
export async function answeringBridge(ctx, { shot = '', disk = {}, slowMirrorMs = 0, notifications = 'granted', documentScan = null, appStore = null } = {}) {
  await ctx.addInitScript(({ shot, disk, slowMirrorMs, notifications, documentScan, appStore }) => {
    const w = window;
    w.webkit = { messageHandlers: { bridge: { postMessage: () => {} } } };
    const KEY = '__keptDisk';
    if (sessionStorage.getItem(KEY) === null) sessionStorage.setItem(KEY, JSON.stringify(disk));
    const files = () => JSON.parse(sessionStorage.getItem(KEY));
    const put = (all) => sessionStorage.setItem(KEY, JSON.stringify(all));
    w.__keptDisk = files;
    const missing = () => Promise.reject(new Error('File does not exist.'));
    // Local notifications: what is pending, kept like the disk so it survives
    // a reload; the permission the person gave (`notifications`); and the
    // listeners the app registered, so a test can tap a notification.
    const NOTES = '__keptNotes';
    if (sessionStorage.getItem(NOTES) === null) sessionStorage.setItem(NOTES, JSON.stringify({ pending: [], asked: 0 }));
    const notes = () => JSON.parse(sessionStorage.getItem(NOTES));
    const putNotes = (n) => sessionStorage.setItem(NOTES, JSON.stringify(n));
    w.__keptNotes = notes;
    const listeners = {};
    w.__tapNotification = (notification) =>
      (listeners.localNotificationActionPerformed ?? []).forEach((cb) => cb({ actionId: 'tap', notification }));
    const display = () => (notifications === 'prompt' ? (notes().asked > 0 ? 'granted' : 'prompt') : notifications);
    const plugins = {
      LocalNotifications: {
        getPending: async () => ({ notifications: notes().pending }),
        cancel: async ({ notifications: gone }) => {
          const n = notes();
          const ids = new Set(gone.map((g) => g.id));
          n.pending = n.pending.filter((p) => !ids.has(p.id));
          putNotes(n);
        },
        checkPermissions: async () => ({ display: display() }),
        requestPermissions: async () => {
          const n = notes();
          n.asked += 1;
          putNotes(n);
          return { display: display() };
        },
        schedule: async ({ notifications: add }) => {
          const n = notes();
          // As the bridge would carry it: JSON, so a Date arrives as a string.
          n.pending = [...n.pending, ...JSON.parse(JSON.stringify(add))];
          putNotes(n);
          return { notifications: add.map((a) => ({ id: a.id })) };
        },
      },
      Camera: { getPhoto: async () => ({ base64String: shot, format: 'png', saved: false }) },
      Filesystem: {
        mkdir: async () => {},
        writeFile: async ({ path, data }) => (put({ ...files(), [path]: data }), { uri: path }),
        readFile: async ({ path }) => {
          if (path === 'kept-receipts.json' && slowMirrorMs > 0) await new Promise((r) => setTimeout(r, slowMirrorMs));
          const all = files();
          return path in all ? { data: all[path] } : missing();
        },
        readdir: async ({ path }) => ({
          files: Object.keys(files()).filter((k) => k.startsWith(`${path}/`)).map((k) => ({ name: k.slice(path.length + 1) })),
        }),
        deleteFile: async ({ path }) => {
          const all = files();
          delete all[path];
          put(all);
        },
        rmdir: async () => {},
        stat: async ({ path }) => (path in files() ? { type: 'file', size: files()[path].length } : missing()),
      },
    };
    w.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'ios',
      PluginHeaders: Object.entries(plugins).map(([name, methods]) => ({
        name,
        methods: Object.keys(methods).map((m) => ({ name: m, rtype: 'promise' })),
      })),
      nativePromise: (plugin, method, options) => plugins[plugin][method](options ?? {}),
      // addListener is a callback method: the core hands it a function to call
      // for every event, which is how a tapped notification reaches the app.
      nativeCallback: (plugin, method, options, callback) => {
        if (method === 'addListener') (listeners[options.eventName] ??= []).push(callback);
        return String(Math.random());
      },
    };
    w.Capacitor.PluginHeaders.find((h) => h.name === 'LocalNotifications').methods.push(
      { name: 'addListener', rtype: 'callback' },
      { name: 'removeListener', rtype: 'promise' },
    );
    plugins.LocalNotifications.removeListener = async () => {};
    /*
     * The document camera (packages/receipt-scanner), declared only when a
     * test hands it pages — or 'cancel' — so every other context is a build
     * without it, and the scan falls back to the camera as it would there.
     */
    if (documentScan !== null) {
      w.__documentScans = 0;
      plugins.ReceiptScanner = {
        isAvailable: async () => ({ available: true }),
        scan: async () => {
          w.__documentScans += 1;
          if (documentScan === 'cancel') throw Object.assign(new Error('The scan was cancelled.'), { code: 'CANCELLED' });
          return { pages: documentScan };
        },
      };
      w.Capacitor.PluginHeaders.push({ name: 'ReceiptScanner', methods: [{ name: 'isAvailable', rtype: 'promise' }, { name: 'scan', rtype: 'promise' }] });
    }
    /*
     * The App Store (packages/purchases, StoreKit 2), declared only when a
     * test describes one, so every other context is a build with nothing for
     * sale. It answers the way the Swift plugin does. What this Apple ID owns
     * is kept like the disk, so it survives a reload, as StoreKit's own record
     * does:
     * - `price`: the App Store's displayPrice, or null when it sells nothing;
     * - `canPay`: false when Screen Time switches purchases off;
     * - `owned`: what StoreKit holds at launch;
     * - `purchase`: how the App Store's sheet ends;
     * - `restoreFinds`: what a sync turns up;
     * - `offline`: the App Store cannot be reached at all.
     * `__approve()` is an Ask to Buy approval and `__refund()` a refund. Both
     * arrive as StoreKit's own `Transaction.updates` would, through the event
     * the plugin raises.
     */
    if (appStore !== null) {
      const STORE = '__keptStore';
      if (sessionStorage.getItem(STORE) === null) {
        sessionStorage.setItem(STORE, JSON.stringify({ owned: appStore.owned ?? 'none', purchases: 0, restores: 0 }));
      }
      const record = () => JSON.parse(sessionStorage.getItem(STORE));
      const keep = (r) => sessionStorage.setItem(STORE, JSON.stringify(r));
      w.__keptStore = record;
      const changed = () => (listeners.entitlementChanged ?? []).forEach((cb) => cb({}));
      const offline = () => Promise.reject(Object.assign(new Error('The Internet connection appears to be offline.'), { code: 'network' }));
      w.__approve = () => (keep({ ...record(), owned: 'owned' }), changed());
      w.__refund = () => (keep({ ...record(), owned: 'revoked' }), changed());
      plugins.Purchases = {
        products: async ({ ids }) => {
          if (appStore.offline) return offline();
          const sold = appStore.price ? [{ id: 'kept.unlimited', displayName: 'Unlimited receipts', displayPrice: appStore.price }] : [];
          return { products: sold.filter((p) => ids.includes(p.id)), canPay: appStore.canPay ?? true };
        },
        purchase: async () => {
          const r = record();
          keep({ ...r, purchases: r.purchases + 1 });
          if (appStore.offline) return { outcome: 'failed', reason: 'network' };
          const ending = appStore.purchase ?? 'purchased';
          if (ending === 'purchased') keep({ ...record(), owned: 'owned' });
          if (ending.startsWith('failed:')) return { outcome: 'failed', reason: ending.slice('failed:'.length) };
          return { outcome: ending };
        },
        entitlement: async () => {
          if (appStore.offline) return offline();
          return { state: record().owned };
        },
        restore: async () => {
          const r = record();
          keep({ ...r, restores: r.restores + 1 });
          if (appStore.offline) return { outcome: 'failed', reason: 'network' };
          if (appStore.restoreFinds) keep({ ...record(), owned: appStore.restoreFinds });
          return { outcome: 'synced' };
        },
        removeListener: async () => {},
      };
      w.Capacitor.PluginHeaders.push({
        name: 'Purchases',
        methods: [
          ...['products', 'purchase', 'entitlement', 'restore', 'removeListener'].map((name) => ({ name, rtype: 'promise' })),
          { name: 'addListener', rtype: 'callback' },
        ],
      });
    }
    const getPhoto = plugins.Camera.getPhoto;
    w.__cameraShots = 0;
    plugins.Camera.getPhoto = async (o) => ((w.__cameraShots += 1), getPhoto(o));
  }, { shot, disk, slowMirrorMs, notifications, documentScan, appStore });
}
