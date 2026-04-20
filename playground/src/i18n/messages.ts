/**
 * User-visible strings for the whole app. Keys use flat dotted namespaces
 * (e.g. `snackbar.running`). Placeholders use `{name}` style; see
 * `interpolate()` in `./format.ts`.
 */

export const en = {
  'app.language.label': 'Language',

  'ctx.cut': 'Cut',
  'ctx.copy': 'Copy',
  'ctx.paste': 'Paste',

  'header.title': 'Board43 Playground',
  'header.subtitle': 'Hack your card with PicoRuby',
  'header.run.device': 'Run on Device',
  'header.run.device.title.connected': 'Upload and run on device',
  'header.run.device.title.disconnected': 'Device not connected',
  'header.run.device.stop': 'Stop on Device',
  'header.run.device.stop.title':
    'Interrupt the program running on the device (Ctrl-C)',
  'header.install': 'Install on Device',
  'header.install.title': 'Install {name} on device as startup',

  'popup.install.title': '🤖 Install {name} on device?',
  'popup.install.description.line1':
    'This will save {name} as /home/app.rb, so the device runs it every time you power it on.',
  'popup.install.description.line2':
    'To cancel the auto-start later, hold the "SW3" button and press the "RUN" button, then keep "SW3" held until the status LED double-flashes 3 times.',
  'popup.install.cancel': 'Cancel',
  'popup.install.confirm': 'Install',

  'status.ready': 'Ready',
  'status.noFile': 'No file selected',
  'status.notConnected': 'Not connected. Please connec to the devicet first.',
  'status.uploading': 'Uploading {name} to the device...',
  'status.started': 'Started {name}',
  'status.stopped': 'Stopped',
  'status.connecting': 'Connecting...',
  'status.connected': 'Connected',
  'status.connectFailed': 'Connection failed',
  'status.deviceDisconnected':
    'Device disconnected. Please reconnect the device.',
  'status.runFailed': 'Run failed: {message}',
  'status.simulatorError': 'Simulator error: {message}',

  'snackbar.uploading': 'Uploading {name}...',
  'snackbar.running': 'Running {name} on device',
  'snackbar.installing': 'Installing {name}...',
  'snackbar.installed': 'Installed {name} as startup program',
  'snackbar.runFailed': 'Run failed: {message}',
  'snackbar.installFailed': 'Install failed: {message}',

  'terminal.label': 'Console',
  'terminal.setup': 'Connect',

  'editor.download': 'Download file',
  'editor.download.title': 'Download the current file',
  'editor.preview': 'Preview',
  'editor.preview.title': 'Run in simulator',
  'editor.preview.stop': 'Stop',
  'editor.preview.stop.title': 'Stop the simulator',
  'editor.uploadImage': 'Upload image',
  'editor.uploadImage.title': 'Pick an image file and convert it to LED pixels',
  'editor.open': 'Open',
  'editor.open.title': 'Open a file from the connected device',
  'editor.open.disabled': 'Connect a device to open files',
  'editor.open.loading': 'Loading files...',
  'editor.open.reading': 'reading',
  'editor.open.empty': 'No files in /home',
  'editor.open.error': 'Failed to load files',
  'editor.open.retry': 'Retry',
  'editor.newFile': 'New File',
  'editor.newFile.title': 'New file',
  'editor.newFile.placeholder': 'filename.rb',
  'editor.newFile.add': 'Add',
  'editor.empty': '🤖 Open a file or create a new one to start editing',

  'emulator.tool.undo': 'Undo',
  'emulator.tool.undo.title': 'Undo last edit (⌘Z)',
  'emulator.tool.redo': 'Redo',
  'emulator.tool.redo.title': 'Redo last undone edit (⌘⇧Z)',
  'emulator.tool.clear': 'Clear all',
  'emulator.tool.clear.title': 'Erase every pixel on the canvas',
  'emulator.tool.customColor': 'Custom color',

  'emulator.animation.label': 'Animation',
  'emulator.animation.title': 'Animation: {label}',
  'emulator.animation.static': 'Static',
  'emulator.animation.scrollLeft': 'Left',
  'emulator.animation.scrollRight': 'Right',
  'emulator.animation.scrollUp': 'Up',
  'emulator.animation.scrollDown': 'Down',
  'emulator.animation.fade': 'Fade',
  'emulator.animation.rotate': 'Rotate',

  'wizard.title': '🤖 Connect device',
  'wizard.error.generic': 'Connection error',
  'wizard.error.noShellPort': 'Could not find the PicoRuby shell port',
  'wizard.error.noShellPort.details':
    'The selected serial port did not respond with a PicoRuby shell prompt, and the other granted ports did not either. Make sure you picked the PicoRuby terminal port (#1). If the status LED blinked 10 times at boot, an installed app.rb is running — hold the "SW3" button and press the "RUN" button, then keep "SW3" held until the status LED double-flashes 3 times, and try again.',
  'wizard.error.noSerialSupport': 'Web Serial API not supported',
  'wizard.error.noSerialSupport.details':
    'This browser does not support Web Serial API. Please use Chrome or Edge.',
  'wizard.error.noPortSelected': 'No port selected',
  'wizard.error.noPortSelected.details':
    'Grant access to the badge serial ports to connect.',
  'wizard.error.connectionFailed': 'Connection failed',
  'wizard.error.unexpected.details':
    'An unexpected error occurred while connecting.',
  'wizard.device.unknown': 'Unknown USB Device',
  'wizard.device.generic': 'USB Device ({vid}:{pid})',
  'wizard.form.device': 'Device',
  'wizard.form.ports.some': '{count} granted serial port(s)',
  'wizard.form.ports.none': 'No granted serial ports yet',
  'wizard.form.ports.addNew': '+ Add',
  'wizard.form.hint':
    'Connect will probe the granted ports and automatically use the PicoRuby shell port. If no ports are granted yet, the browser will ask for access.',
  'wizard.form.baudRate': 'Baud Rate',
  'wizard.button.connect': 'Connect',
  'wizard.button.connecting': 'Connecting...',
  'wizard.button.skip': 'Skip — use simulator only',
} as const;

export type MessageKey = keyof typeof en;

/**
 * A translation request carried through state and props. Stores the key (and
 * optional interpolation params) rather than a resolved string, so the text is
 * recomputed with the current locale at render time. For dynamic fragments
 * (e.g. an underlying `Error.message`) use the `text` variant instead.
 */
export type LocalizedMessage =
  | { key: MessageKey; params?: import('./types').TParams }
  | { text: string };

/**
 * Typed as `Record<MessageKey, string>` so TypeScript flags any key that is
 * missing from the Japanese catalog. Every new English key must land with its
 * Japanese translation in the same commit.
 */
export const ja: Record<MessageKey, string> = {
  'app.language.label': '言語',

  'ctx.cut': '切り取り',
  'ctx.copy': 'コピー',
  'ctx.paste': '貼り付け',

  'header.title': 'Board43 Playground',
  'header.subtitle': 'Hack your card with PicoRuby',
  'header.run.device': 'デバイスで実行',
  'header.run.device.title.connected': 'デバイスにアップロードして実行',
  'header.run.device.title.disconnected': 'デバイス未接続',
  'header.run.device.stop': 'デバイスを停止',
  'header.run.device.stop.title':
    'デバイスで動いているプログラムを中断 (Ctrl-C)',
  'header.install': 'デバイスにインストール',
  'header.install.title': '{name} をデバイスの自動起動に設定',

  'popup.install.title': '🤖 {name} をデバイスにインストールしますか？',
  'popup.install.description.line1':
    '{name} が /home/app.rb として保存され、デバイスの電源を入れるたびに自動で実行されます。',
  'popup.install.description.line2':
    '自動起動をあとで解除するには、「SW3」ボタンを押したまま「RUN」ボタンを押して再起動し、ステータス LED が 3 回フラッシュするまで「SW3」ボタンを押したままにしてください。',
  'popup.install.cancel': 'キャンセル',
  'popup.install.confirm': 'インストール',

  'status.ready': '🤖 準備完了',
  'status.noFile': '🤖 ファイルが選択されていません',
  'status.notConnected': '🤖 未接続です。先に接続してください。',
  'status.uploading': '🤖 {name} をデバイスにアップロード中...',
  'status.started': '🤖 {name} を実行開始',
  'status.stopped': '🤖 停止しました',
  'status.connecting': '🤖 接続中...',
  'status.connected': '🤖 接続済み',
  'status.connectFailed': '🤖 接続に失敗しました',
  'status.deviceDisconnected':
    '🤖 デバイスが切断されました。再接続してください。',
  'status.runFailed': '🤖 実行に失敗: {message}',
  'status.simulatorError': '🤖 シミュレータエラー: {message}',

  'snackbar.uploading': '{name} をアップロード中...',
  'snackbar.running': '{name} をデバイスで実行中',
  'snackbar.installing': '{name} をインストール中...',
  'snackbar.installed': '{name} を自動起動プログラムとして設定しました',
  'snackbar.runFailed': '実行に失敗: {message}',
  'snackbar.installFailed': 'インストールに失敗: {message}',

  'terminal.label': 'コンソール',
  'terminal.setup': '接続',

  'editor.download': 'ファイルをダウンロード',
  'editor.download.title': '現在のファイルをダウンロード',
  'editor.preview': 'プレビュー',
  'editor.preview.title': 'シミュレータで実行',
  'editor.preview.stop': '停止',
  'editor.preview.stop.title': 'シミュレータを停止',
  'editor.uploadImage': '画像をアップロード',
  'editor.uploadImage.title': '画像ファイルを選んで LED ピクセルに変換します',
  'editor.open': '開く',
  'editor.open.title': '接続中のデバイスからファイルを開く',
  'editor.open.disabled': 'デバイスを接続すると開けます',
  'editor.open.loading': 'ファイルを読み込み中...',
  'editor.open.reading': '読み込み中',
  'editor.open.empty': '/home にファイルがありません',
  'editor.open.error': 'ファイル一覧の取得に失敗しました',
  'editor.open.retry': '再試行',
  'editor.newFile': '新規ファイル',
  'editor.newFile.title': '新規ファイル',
  'editor.newFile.placeholder': 'filename.rb',
  'editor.newFile.add': '追加',
  'editor.empty':
    '🤖 ファイルをデバイスから開くするか、新しく作成して始めましょう',

  'emulator.tool.undo': '元に戻す',
  'emulator.tool.undo.title': '直前の編集を取り消します (⌘Z)',
  'emulator.tool.redo': 'やり直し',
  'emulator.tool.redo.title': '取り消した編集をやり直します (⌘⇧Z)',
  'emulator.tool.clear': 'すべてクリア',
  'emulator.tool.clear.title': 'キャンバス上のすべてのピクセルを消します',
  'emulator.tool.customColor': 'カスタムカラー',

  'emulator.animation.label': 'アニメーション',
  'emulator.animation.title': 'アニメーション: {label}',
  'emulator.animation.static': '静止',
  'emulator.animation.scrollLeft': '左',
  'emulator.animation.scrollRight': '右',
  'emulator.animation.scrollUp': '上',
  'emulator.animation.scrollDown': '下',
  'emulator.animation.fade': 'フェード',
  'emulator.animation.rotate': '回転',

  'wizard.title': '🤖 デバイスを接続しましょう',
  'wizard.error.generic': '接続エラー',
  'wizard.error.noShellPort': 'PicoRuby シェルのポートが見つかりませんでした',
  'wizard.error.noShellPort.details':
    '選択されたシリアルポートに PicoRuby シェルのプロンプトが現れず、許可されている他のポートでも同様でした。PicoRuby のターミナルポート (#1) を選んでいるか確認してください。起動時にステータス LED が 10 回点滅した場合は、インストール済みの app.rb が実行されています。「SW3」ボタンを押したまま「RUN」ボタンを押して再起動し、ステータス LED が 3 回フラッシュするまで「SW3」ボタンを押したままにすると自動起動をスキップできます。その後で再度試してください。',
  'wizard.error.noSerialSupport': 'Web Serial API に対応していません',
  'wizard.error.noSerialSupport.details':
    'このブラウザは Web Serial API に対応していません。Chrome か Edge を使ってください。',
  'wizard.error.noPortSelected': 'ポートが選択されていません',
  'wizard.error.noPortSelected.details':
    '接続するにはバッジのシリアルポートへのアクセスを許可してください。',
  'wizard.error.connectionFailed': '接続に失敗しました',
  'wizard.error.unexpected.details': '接続中に予期しないエラーが発生しました。',
  'wizard.device.unknown': '不明な USB デバイス',
  'wizard.device.generic': 'USB デバイス ({vid}:{pid})',
  'wizard.form.device': 'デバイス',
  'wizard.form.ports.some': '{count} 個のシリアルポートが許可されています',
  'wizard.form.ports.none': '許可されたシリアルポートがありません',
  'wizard.form.ports.addNew': '+ 追加',
  'wizard.form.hint':
    '「接続」を押すと、許可されたポートを順に調べて PicoRuby シェルのポートを自動で認識します。まだ許可されていない場合、ブラウザがアクセスを求めます。',
  'wizard.form.baudRate': 'ボーレート',
  'wizard.button.connect': '接続',
  'wizard.button.connecting': '接続中...',
  'wizard.button.skip': '接続をスキップしてシミュレータのみ使う',
};

export const messages = { en, ja };
