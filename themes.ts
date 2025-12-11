import { ThemeColor } from './types';

// We use RGB values to allow Tailwind opacity modifiers (e.g., bg-primary-500/50)
// format: "r g b"
export const themes: Record<ThemeColor, Record<number | 950, string>> = {
  pine: {
    50: '240 253 244',
    100: '220 252 231',
    200: '187 247 208',
    300: '134 239 172',
    400: '51 138 78',
    500: '38 120 64',
    600: '30 99 52',
    700: '24 80 43',
    800: '20 64 36',
    900: '17 51 30',
    950: '8 28 15',
  },
  ocean: {
    50: '240 249 255',
    100: '224 242 254',
    200: '186 230 253',
    300: '125 211 252',
    400: '56 189 248',
    500: '14 165 233', // Sky-500
    600: '2 132 199',
    700: '3 105 161',
    800: '7 89 133',
    900: '12 74 110',
    950: '8 47 73',
  },
  sunset: {
    50: '255 241 242',
    100: '255 228 230',
    200: '254 205 211',
    300: '253 164 175',
    400: '251 113 133',
    500: '244 63 94', // Rose-500
    600: '225 29 72',
    700: '190 18 60',
    800: '159 18 57',
    900: '136 19 55',
    950: '76 5 25',
  },
  lavender: {
    50: '245 243 255',
    100: '237 233 254',
    200: '221 214 254',
    300: '196 181 253',
    400: '167 139 250',
    500: '139 92 246', // Violet-500
    600: '124 58 237',
    700: '109 40 217',
    800: '91 33 182',
    900: '76 29 149',
    950: '46 16 101',
  },
  graphite: {
    50: '248 250 252',
    100: '241 245 249',
    200: '226 232 240',
    300: '203 213 225',
    400: '148 163 184',
    500: '100 116 139', // Slate-500
    600: '71 85 105',
    700: '51 65 85',
    800: '30 41 59',
    900: '15 23 42',
    950: '2 6 23',
  }
};

// CSS Variable Injection Helper
export const applyTheme = (theme: ThemeColor) => {
  const root = document.documentElement;
  const palette = themes[theme];
  
  Object.entries(palette).forEach(([shade, value]) => {
    root.style.setProperty(`--color-primary-${shade}`, value);
  });
};

export const getThemeGradient = (theme: ThemeColor): string => {
  switch (theme) {
    case 'ocean': return "linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)";
    case 'sunset': return "linear-gradient(135deg, #ffe4e6 0%, #fff1f2 100%)";
    case 'lavender': return "linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)";
    case 'graphite': return "linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%)";
    case 'pine': 
    default:
      return "linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)";
  }
};
