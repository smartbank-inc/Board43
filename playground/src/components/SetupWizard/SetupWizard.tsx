import { useCallback, useEffect, useRef, useState } from 'react';
import { Banner, Button, Popup, SelectableField } from '..';
import type { LocalizedMessage, TFn } from '../../i18n';
import { resolveMessage, useI18n } from '../../i18n';
import type { Locale } from '../../i18n/types';
import { FlexBox } from '../../layout';
import './SetupWizard.css';

// Known USB device names by VID:PID
const KNOWN_DEVICES: Record<string, string> = {
  '16c0:4002': 'PicoRuby R2P2',
};

function getDeviceLabel(t: TFn, vendorId?: number, productId?: number): string {
  if (vendorId === undefined || productId === undefined) {
    return t('wizard.device.unknown');
  }
  const vid = vendorId.toString(16).padStart(4, '0');
  const pid = productId.toString(16).padStart(4, '0');
  const key = `${vid}:${pid}`;
  const knownName = KNOWN_DEVICES[key];
  if (knownName) {
    return knownName;
  }
  return t('wizard.device.generic', { vid, pid });
}

interface SerialPortInfo {
  port: SerialPort;
  label: string;
}

interface ConnectionResult {
  success: boolean;
  error?: LocalizedMessage;
  details?: LocalizedMessage;
}

interface SetupWizardProps {
  serialConnected: boolean;
  baudRate: number;
  connectionError: LocalizedMessage | null;
  onBaudRateChange: (baudRate: number) => void;
  onConnectSerial: (port?: SerialPort) => Promise<ConnectionResult>;
  onClearConnectionError: () => void;
  onStart: () => void;
}

export function SetupWizard({
  serialConnected,
  baudRate,
  connectionError,
  onBaudRateChange,
  onConnectSerial,
  onClearConnectionError,
  onStart,
}: SetupWizardProps) {
  const { locale, setLocale, t } = useI18n();
  const [availablePorts, setAvailablePorts] = useState<SerialPortInfo[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [errorDetails, setErrorDetails] = useState<LocalizedMessage | null>(
    null,
  );
  const baudRateSelectRef = useRef<HTMLSelectElement>(null);

  const refreshPortsFromList = useCallback(
    (ports: SerialPort[]) => {
      const portInfos: SerialPortInfo[] = ports.map((port) => {
        const info = port.getInfo();
        return {
          port,
          label: getDeviceLabel(t, info.usbVendorId, info.usbProductId),
        };
      });
      const labelCounts = new Map<string, number>();
      const labelIndices = new Map<string, number>();
      for (const info of portInfos) {
        labelCounts.set(info.label, (labelCounts.get(info.label) ?? 0) + 1);
      }
      for (const info of portInfos) {
        const count = labelCounts.get(info.label) ?? 1;
        if (count > 1) {
          const index = (labelIndices.get(info.label) ?? 0) + 1;
          labelIndices.set(info.label, index);
          info.label = `${info.label} #${index}`;
        }
      }
      setAvailablePorts(portInfos);
    },
    [t],
  );

  const refreshPorts = useCallback(async () => {
    if (!('serial' in navigator)) return;
    try {
      const ports = await navigator.serial.getPorts();
      refreshPortsFromList(ports);
    } catch {
      // Ignore errors
    }
  }, [refreshPortsFromList]);

  useEffect(() => {
    refreshPorts();
  }, [refreshPorts]);

  useEffect(() => {
    if (serialConnected) onStart();
  }, [serialConnected, onStart]);

  // Focus the baud rate dropdown shortly after the dialog opens.
  useEffect(() => {
    const timer = setTimeout(() => {
      baudRateSelectRef.current?.focus();
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setErrorDetails(null);
    onClearConnectionError();

    try {
      const result = await onConnectSerial();
      if (!result.success) {
        setErrorDetails(result.details ?? null);
      }
    } finally {
      setConnecting(false);
    }
  }, [onConnectSerial, onClearConnectionError]);

  const handleRequestNewPort = useCallback(async () => {
    if (!('serial' in navigator)) return;
    try {
      await navigator.serial.requestPort();
      const ports = await navigator.serial.getPorts();
      refreshPortsFromList(ports);
    } catch {
      // User cancelled
    }
  }, [refreshPortsFromList]);

  const handleSetActive = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const nextValue = typeof next === 'function' ? next(true) : next;
      if (!nextValue) onStart();
    },
    [onStart],
  );

  return (
    <Popup
      isActive
      setIsActive={handleSetActive}
      title={t('wizard.title')}
      footer={
        <FlexBox
          direction="row"
          gap="extra-small"
          justify="flex-end"
          width="full"
        >
          <Button
            appearance="outlined"
            width="hug"
            onClick={onStart}
            disabled={connecting}
          >
            {t('wizard.button.skip')}
          </Button>
          <Button
            appearance="filled"
            width="hug"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting
              ? t('wizard.button.connecting')
              : t('wizard.button.connect')}
          </Button>
        </FlexBox>
      }
    >
      <FlexBox
        className="wizard-language-select"
        direction="row"
        align="center"
        gap="two-extra-small"
        width="hug"
      >
        <span className="wizard-language-label">Language:</span>
        <select
          className="language-select"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          aria-label={t('app.language.label')}
        >
          <option value="en">English</option>
          <option value="ja">Japanese</option>
        </select>
      </FlexBox>
      <FlexBox className="wizard-body" gap="medium" width="full">
        {(connectionError || errorDetails) && (
          <Banner
            color="negative"
            title={
              connectionError
                ? resolveMessage(t, connectionError)
                : t('wizard.error.generic')
            }
            description={
              errorDetails ? resolveMessage(t, errorDetails) : undefined
            }
          />
        )}

        <FlexBox gap="extra-small">
          <span className="form-label">{t('wizard.form.device')}</span>
          {availablePorts.length > 0 ? (
            <FlexBox direction="row" align="center" gap="small">
              <span className="connected-detail">
                {t('wizard.form.ports.some', {
                  count: availablePorts.length,
                })}
              </span>
              <button
                type="button"
                className="link-button"
                onClick={handleRequestNewPort}
                disabled={connecting}
              >
                {t('wizard.form.ports.addNew')}
              </button>
            </FlexBox>
          ) : (
            <span className="connected-detail">
              {t('wizard.form.ports.none')}
            </span>
          )}
          {availablePorts.length > 0 && (
            <div className="port-list">
              {availablePorts.map((info) => info.label).join(', ')}
            </div>
          )}
          <p className="form-hint">{t('wizard.form.hint')}</p>
        </FlexBox>

        <SelectableField
          title={t('wizard.form.baudRate')}
          ref={baudRateSelectRef}
          value={baudRate}
          onChange={(e) => onBaudRateChange(Number(e.target.value))}
          disabled={connecting}
          options={[
            { value: '9600', label: '9600' },
            { value: '19200', label: '19200' },
            { value: '38400', label: '38400' },
            { value: '57600', label: '57600' },
            { value: '115200', label: '115200' },
          ]}
        />
      </FlexBox>
    </Popup>
  );
}
