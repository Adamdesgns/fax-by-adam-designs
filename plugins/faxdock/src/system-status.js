import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function queryFaxService() {
  if (process.platform !== 'win32') return { installed: false, state: 'unsupported-os' };
  const result = spawnSync('sc.exe', ['query', 'Fax'], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return { installed: false, state: 'not-installed' };
  const match = result.stdout.match(/STATE\s*:\s*\d+\s+(\w+)/i);
  return { installed: true, state: match?.[1]?.toLowerCase() || 'unknown' };
}

function queryModems() {
  if (process.platform !== 'win32') return [];
  const script = [
    "$items = Get-CimInstance Win32_POTSModem -ErrorAction SilentlyContinue |",
    "Select-Object Name, Status, AttachedTo;",
    "if ($items) { $items | ConvertTo-Json -Compress } else { '[]' }",
  ].join(' ');
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8', windowsHide: true, timeout: 10_000 },
  );
  if (result.status !== 0) return [];
  try {
    const parsed = JSON.parse(result.stdout.trim() || '[]');
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export function getSystemStatus(transport) {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const faxClient = path.join(systemRoot, 'System32', 'WFS.exe');
  const service = queryFaxService();
  const modems = queryModems();
  const ready = transport !== 'disabled' && service.installed && modems.length > 0;
  return {
    platform: process.platform,
    configuredTransport: transport,
    windowsFaxClientInstalled: fs.existsSync(faxClient),
    windowsFaxService: service,
    detectedFaxModems: modems,
    realTransmissionReady: ready,
    blocker: ready
      ? null
      : 'No enabled transport with a detected fax modem and Windows Fax service.',
  };
}
