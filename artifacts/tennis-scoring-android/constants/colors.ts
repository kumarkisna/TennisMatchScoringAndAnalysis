/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#243b30',
    tint: '#285743',
    background: '#f4f1e8',
    foreground: '#253d32',
    card: '#fbfaf5',
    cardForeground: '#253d32',
    primary: '#285743',
    primaryForeground: '#fbf8ee',
    secondary: '#e9e5da',
    secondaryForeground: '#30453b',
    muted: '#ebe7de',
    mutedForeground: '#7b8178',
    accent: '#c25f42',
    accentForeground: '#fbf8ee',
    destructive: '#9d493c',
    destructiveForeground: '#ffffff',
    border: '#ded9cc',
    input: '#dcd7cb',
  },
  dark: {
    text: '#f1ecdf',
    tint: '#78b998',
    background: '#18251f',
    foreground: '#eee9dc',
    card: '#202e27',
    cardForeground: '#eee9dc',
    primary: '#78b998',
    primaryForeground: '#17231d',
    secondary: '#2c3a32',
    secondaryForeground: '#eee9dc',
    muted: '#2b3831',
    mutedForeground: '#a9b1a8',
    accent: '#d77b5b',
    accentForeground: '#ffffff',
    destructive: '#c56759',
    destructiveForeground: '#ffffff',
    border: '#3a4940',
    input: '#3a4940',
  },
  radius: 14,
};

export default colors;
