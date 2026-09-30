// Loading and switching sounds, ambience and scenes. Shared by several tabs.
import { loopBuffer } from '../audio.js';
import { loadPack } from '../packs.js';
import { SCENES } from '../scenes.js';
import { sk, engine, S, PACKS, AMBS, app, loaded, note, emit, render } from './core.js';

export const SYNTH_AMBIENCES = [['wind', 'Wind'], ['rain', 'Soft rain'], ['night', 'Night'], ['room', 'Room tone']];

export const ambName = (id) =>
  id === 'none' ? 'no ambience'
    : (AMBS.find((a) => a.id === id)?.name || SYNTH_AMBIENCES.find((a) => a[0] === id)?.[1] || id).toLowerCase();

export const allScenes = () => [...SCENES, ...S.customScenes];

const toArrayBuffer = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

export async function getPack(id) {
  if (!loaded.has(id)) loaded.set(id, await loadPack(id, engine, sk));
  return loaded.get(id);
}

export async function usePack(id) {
  try {
    app.pack = await getPack(id);
    S.pack = id;
  } catch (e) {
    note(`Couldn't load that sound: ${e.message}. Using the shotgun blast instead.`, true);
    app.pack = await getPack('synth');
    S.pack = 'synth';
  }
  engine.pitchJitter = app.pack.jitter;
  engine.setTone(S.tone[S.pack]);       // tone is kept per sound
  emit('tone');
}

const ambCache = new Map();
export const forgetAmbience = (id) => ambCache.delete(id);

async function ambAsset(id) {
  if (!ambCache.has(id)) {
    const r = await sk.readAmbience(id);
    const buffer = loopBuffer(engine.ctx, await engine.ctx.decodeAudioData(toArrayBuffer(r.data)));
    const thunder = r.thunder ? await engine.ctx.decodeAudioData(toArrayBuffer(r.thunder)) : null;
    ambCache.set(id, { buffer, thunder });
  }
  return ambCache.get(id);
}

/** slot 0 is the main bed, 1 and up are extra layers. */
export async function setAmb(type, volume, slot = 0) {
  let asset = null;
  if (/^[bu]:/.test(type)) {
    try { asset = await ambAsset(type); }
    catch (e) {
      note(`Couldn't load that ambience: ${e.message}.`, true);
      type = 'none';
      if (!slot) S.ambience.type = 'none';
    }
  }
  engine.setAmbience(type, volume, asset, slot);
}

// Manual tweaks mean the current mix is no longer exactly a saved scene.
export function touch() {
  if (S.scene) { S.scene = null; sk.patch({ scene: null }); emit('scenes'); }
}

export async function applyScene(sc) {
  let packId = sc.pack;
  let fellBack = false;
  if (packId === 'mech:any') {
    const m = PACKS.find((p) => p.id.startsWith('mech:'));
    if (m) packId = m.id; else { packId = 'synth'; fellBack = true; }
  } else if (!PACKS.some((p) => p.id === packId)) {
    packId = 'synth'; fellBack = true;
  }
  S.scene = sc.id;
  S.reverb = { ...sc.reverb };
  S.ambience = { type: sc.ambience, volume: sc.ambVol };
  if (sc.reactive) S.reactive = { ...S.reactive, ...sc.reactive };   // a scene can switch reactive ambience on or off
  await usePack(packId);
  engine.setReverb(S.reverb);
  await setAmb(S.ambience.type, S.ambience.volume);
  sk.patch({ scene: S.scene, pack: S.pack, reverb: S.reverb, ambience: S.ambience, reactive: S.reactive });
  render();
  if (fellBack) note(`No keyboard pack is installed yet, so ${sc.name} is using the shotgun sound. Add one under Sounds.`);
}
