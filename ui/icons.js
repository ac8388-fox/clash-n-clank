// Pixel-style line icons from the mockups (docs/mockups/house and full).
// Each draws twice: a sky-blue copy offset down-right (the shadow, light from
// the upper left), then the white icon on top.

const PATHS = {
  STR: 'M7 25 L23 9 M23 9 L27 5 M10 16 L16 22 M5 27 L8 24',                         // sword
  AGI: 'M18 3 L8 18 H15 L13 29 L24 13 H17 Z',                                        // lightning
  WIS: 'M3 16 C8 9 24 9 29 16 C24 23 8 23 3 16 Z M20 16 A4 4 0 1 1 19.9 16 Z',       // eye
  FAI: 'M16 4 C20 10 24 13 24 19 C24 24 20 28 16 28 C12 28 8 24 8 19 C8 15 11 13 12 9 C14 12 15 13 16 14 C16 10 16 7 16 4 Z', // flame
  item: 'M13 4 H19 M14 4 V12 L7 26 H25 L18 12 V4 M10 20 H22',                        // flask
  block: 'M16 4 L26 8 L26 16 C26 22 21 26 16 28 C11 26 6 22 6 16 L6 8 Z',            // shield
  head: 'M16 4 A8 8 0 1 1 15.9 4 Z M8 28 C8 22 24 22 24 28',
  left: 'M26 16 H6 M12 10 L6 16 L12 22',
  right: 'M6 16 H26 M20 10 L26 16 L20 22',
  legs: 'M11 4 V28 M21 4 V28 M11 28 H6 M21 28 H26 M11 4 H21',
  post: 'M16 3 V29 M8 29 H24 M6 12 H12 M20 12 H26 M6 12 V18 M26 12 V18',
  key: 'M10 16 A5 5 0 1 1 9.9 16 M15 16 H28 M25 16 V21 M21 16 V20',
  fist: 'M7 15 H25 V25 H7 Z M7 15 V10 H11 V15 M11 10 V8 H15 V15 M15 8 H19 V15 M19 9 H23 V15 M25 18 H28 V23 H25',
  hammer: 'M5 27 L19 13 M19 13 L22 10 M8 18 L12 22 M14 5 C22 3 28 9 27 17 M27 17 L23 14 M27 17 L29 12',
  mountain: 'M3 27 L12 10 L17 18 L21 13 L29 27 Z',
  swap: 'M6 11 H24 M19 6 L24 11 L19 16 M26 21 H8 M13 16 L8 21 L13 26',               // Plan B: switch weapons
  moon: 'M20 4 C12 5 7 11 7 18 C7 24 12 28 18 28 C23 28 27 25 28 21 C24 23 18 22 15 18 C12 14 14 7 20 4 Z',
  fire: 'M16 6 C19 11 22 13 22 18 C22 22 19 25 16 25 C13 25 10 22 10 18 C10 15 12 13 13 10 C14 12 15 13 16 14 Z M6 28 H26',
  leave: 'M14 6 H6 V26 H14 M12 16 H28 M22 10 L28 16 L22 22',
  star: 'M16 3 L19.5 12 L29 12.5 L21.5 18.5 L24 28 L16 22.5 L8 28 L10.5 18.5 L3 12.5 L12.5 12 Z',
  person: 'M16 4 A6 6 0 1 1 15.9 4 Z M6 29 C6 20 26 20 26 29 Z',
  bag: 'M8 10 H24 V28 H8 Z M12 10 V7 C12 3 20 3 20 7 V10 M8 18 H24 M14 18 V22 H18 V18',
  book: 'M5 6 H15 C16 6 16 7 16 8 V27 C16 25 15 24 13 24 H5 Z M27 6 H17 C16 6 16 7 16 8 V27 C16 25 17 24 19 24 H27 Z',
  dice: 'M6 6 H26 V26 H6 Z M11 11 H12 M20 11 H21 M16 16 H17 M11 21 H12 M20 21 H21',
  gear: 'M16 10 A6 6 0 1 1 15.9 10 Z M16 3 V7 M16 25 V29 M3 16 H7 M25 16 H29 M7 7 L10 10 M22 22 L25 25 M25 7 L22 10 M10 22 L7 25',
  play: 'M9 5 L26 16 L9 27 Z',
  pray: 'M16 3 V29 M8 11 H24',                                                        // a plain cross
};

// An icon as an SVG string. size in pixels.
export function icon(name, size = 38, stroke = 2.5) {
  const d = PATHS[name];
  if (!d) return '';
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke-width="${stroke}" stroke-linecap="square">` +
    `<path transform="translate(1.5 1.5)" stroke="#5BC8F5" d="${d}"></path><path stroke="#FFFFFF" d="${d}"></path></svg>`;
}

export function hasIcon(name) { return !!PATHS[name]; }

export const MENU_ICON = '<svg width="26" height="22" viewBox="0 0 26 22" aria-hidden="true" stroke="#FFFFFF" stroke-width="3"><path d="M2 3 H24 M2 11 H24 M2 19 H24"></path></svg>';
export const CLOSE_ICON = '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" stroke="#000000" stroke-width="3"><path d="M3 3 L19 19 M19 3 L3 19"></path></svg>';
export const ROSE_ICON = '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke-width="2"><g transform="translate(2 2)" stroke="#5BC8F5"><circle cx="16" cy="16" r="13"></circle><path d="M16 5 L20 16 L16 14 L12 16 Z"></path></g><g stroke="#FFFFFF"><circle cx="16" cy="16" r="13"></circle><path d="M16 5 L20 16 L16 14 L12 16 Z" fill="#FFFFFF"></path><path d="M16 27 L12 16 L16 18 L20 16 Z"></path></g></svg>';
export const FACING_TRIANGLE = '<svg width="14" height="8" viewBox="0 0 14 8" aria-hidden="true"><path d="M7 0 L14 8 L0 8 Z" fill="#FFFFFF"></path></svg>';
