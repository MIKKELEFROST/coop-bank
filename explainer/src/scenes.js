/**
 * scenes.js — scene registry.
 *
 * Every module exports the same shape:
 *   {
 *     id: 'beat-0X',
 *     build(root, api) -> refs      // runs once, creates all DOM
 *     render(t, refs, api)          // t = seconds since this beat started
 *   }
 *
 * render() must write EVERY animated property it owns on every call: frames
 * are rendered in arbitrary order, so nothing may be left over from a
 * previous call.
 */

import beat01 from './scenes/beat01.js';
import beat02 from './scenes/beat02.js';
import beat03 from './scenes/beat03.js';
import beat04 from './scenes/beat04.js';
import beat05 from './scenes/beat05.js';
import beat06 from './scenes/beat06.js';
import beat07 from './scenes/beat07.js';
import beat08 from './scenes/beat08.js';
import beat09 from './scenes/beat09.js';
import beat10 from './scenes/beat10.js';
import beat11 from './scenes/beat11.js';
import beat12 from './scenes/beat12.js';

export const SCENES = {
  'beat-01': beat01,
  'beat-02': beat02,
  'beat-03': beat03,
  'beat-04': beat04,
  'beat-05': beat05,
  'beat-06': beat06,
  'beat-07': beat07,
  'beat-08': beat08,
  'beat-09': beat09,
  'beat-10': beat10,
  'beat-11': beat11,
  'beat-12': beat12,
};

export default SCENES;
