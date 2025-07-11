/**
 * Maps uiohook-napi keycodes to human-readable key names.
 * Keycodes follow USB HID scan code conventions used by uiohook.
 */
export const KEY_NAMES: Record<number, string> = {
  // Row 0 – Escape / Function keys
  1: "Escape",
  59: "F1",
  60: "F2",
  61: "F3",
  62: "F4",
  63: "F5",
  64: "F6",
  65: "F7",
  66: "F8",
  67: "F9",
  68: "F10",
  87: "F11",
  88: "F12",

  // Row 1 – Numbers
  41: "`",
  2: "1",
  3: "2",
  4: "3",
  5: "4",
  6: "5",
  7: "6",
  8: "7",
  9: "8",
  10: "9",
  11: "0",
  12: "-",
  13: "=",
  14: "Backspace",

  // Row 2 – QWERTY
  15: "Tab",
  16: "Q",
  17: "W",
  18: "E",
  19: "R",
  20: "T",
  21: "Y",
  22: "U",
  23: "I",
  24: "O",
  25: "P",
  26: "[",
  27: "]",
  43: "\\",

  // Row 3 – ASDF
  58: "Caps Lock",
  30: "A",
  31: "S",
  32: "D",
  33: "F",
  34: "G",
  35: "H",
  36: "J",
  37: "K",
  38: "L",
  39: ";",
  40: "'",
  28: "Enter",

  // Row 4 – ZXCV
  42: "Left Shift",
  44: "Z",
  45: "X",
  46: "C",
  47: "V",
  48: "B",
  49: "N",
  50: "M",
  51: ",",
  52: ".",
  53: "/",
  54: "Right Shift",

  // Row 5 – Bottom
  29: "Left Ctrl",
  56: "Left Alt",
  57: "Space",
  3640: "Right Alt",
  3613: "Right Ctrl",
  3675: "Left Meta",
  3676: "Right Meta",

  // Navigation
  3655: "Home",
  3663: "End",
  3657: "Page Up",
  3665: "Page Down",
  3666: "Insert",
  3667: "Delete",

  // Arrows
  3656: "Up",
  3664: "Down",
  3659: "Left",
  3661: "Right",

  // Numpad
  69: "Num Lock",
  3637: "Num /",
  55: "Num *",
  74: "Num -",
  78: "Num +",
  3612: "Num Enter",
  83: "Num .",
  82: "Num 0",
  79: "Num 1",
  80: "Num 2",
  81: "Num 3",
  75: "Num 4",
  76: "Num 5",
  77: "Num 6",
  71: "Num 7",
  72: "Num 8",
  73: "Num 9",

  // Misc
  3639: "Print Screen",
  70: "Scroll Lock",
  3653: "Pause",
};

export function getKeyName(keycode: number): string {
  return KEY_NAMES[keycode] ?? `Key ${keycode}`;
}
