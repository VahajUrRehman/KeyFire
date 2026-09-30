// Per-device volume: with "remember volume for each device" on, plugging in headphones brings back
// the volume you used on them last time.
import { sk, engine, S, $, setSlider } from './core.js';

let current = null;   // id of the output device that is playing right now

/** Which physical device is playing: the chosen one, or whatever "System default" points at. */
async function resolveDevice() {
  const outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
  if (S.outputDevice) {
    const d = outs.find((x) => x.deviceId === S.outputDevice);
    return { id: S.outputDevice, label: d?.label || 'Selected device' };
  }
  const def = outs.find((d) => d.deviceId === 'default');
  const real = def && outs.find((d) => d.deviceId !== 'default' && d.deviceId !== 'communications' && d.groupId === def.groupId);
  return { id: real?.deviceId || 'default', label: real?.label || def?.label?.replace(/^Default - /, '') || 'System default' };
}

/** Call at start, when the device list changes, and after choosing a device. */
export async function syncDevice() {
  let d;
  try { d = await resolveDevice(); } catch { return; }
  $('#devName').textContent = `Playing on ${d.label}`;
  if (d.id === current) return;
  current = d.id;
  const saved = S.deviceVolumes[d.id];
  if (S.perDevice && typeof saved === 'number') {
    S.volume = saved;
    engine.setVolume(saved);
    setSlider('vol', 'volOut', saved);
    sk.patch({ volume: saved });
  }
}

/** Call when the volume slider is released. */
export function rememberVolume() {
  if (!S.perDevice || !current) return;
  S.deviceVolumes[current] = S.volume;
  sk.patch({ deviceVolumes: S.deviceVolumes });
}

export function initDevices() {
  $('#perDevice').checked = !!S.perDevice;
  $('#perDevice').addEventListener('change', (e) => {
    S.perDevice = e.target.checked;
    sk.patch({ perDevice: S.perDevice });
    if (S.perDevice) rememberVolume();        // the device in use keeps the volume it has now
  });
  navigator.mediaDevices?.addEventListener('devicechange', syncDevice);
  syncDevice();
}
