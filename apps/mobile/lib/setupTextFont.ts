/**
 * Global default font for <Text>.
 *
 * Warm Editorial uses Plus Jakarta Sans for all body copy. Rather than set
 * `fontFamily` on every Text in the app, we patch Text.render once to inject
 * the correct Jakarta weight as a *default* — any explicit `fontFamily` in a
 * component's style still wins (so Bricolage / DM Mono / Instrument Serif usage
 * is untouched). This gives every un-migrated screen consistent body type for
 * free, with the right weight mapped from `fontWeight`.
 *
 * Implementation note: we augment the *input props* (prepend a default
 * fontFamily to the style) and let the original render run normally — we do
 * NOT clone/rewrap the rendered output. Rewrapping the output conflicts with
 * NativeWind's CssInterop wrapper and React Native's dev LogBox (both of which
 * also process Text), which previously surfaced as cascading render errors in
 * the dev error overlay. Everything here is wrapped in try/catch so a stray
 * edge case can never break text rendering.
 */
import { Text, StyleSheet } from 'react-native';
import { fonts } from '@/config/theme';

function familyForWeight(weight?: string | number): string {
  switch (String(weight)) {
    case '500':
      return fonts.bodyMed;
    case '600':
      return fonts.bodySemi;
    case '700':
    case '800':
    case '900':
    case 'bold':
      return fonts.bodyBold;
    default:
      return fonts.body;
  }
}

const TextAny = Text as unknown as {
  render?: (...args: unknown[]) => unknown;
  __detourFontPatched?: boolean;
};

if (TextAny.render && !TextAny.__detourFontPatched) {
  const original = TextAny.render;
  TextAny.render = function patchedRender(...args: unknown[]) {
    try {
      const props = args[0] as { style?: unknown } | undefined;
      const flat = (StyleSheet.flatten(props?.style) ?? {}) as {
        fontFamily?: string;
        fontWeight?: string | number;
      };
      // Respect any explicit fontFamily (Bricolage / mono / serif / migrated).
      if (props && !flat.fontFamily) {
        const fontFamily = familyForWeight(flat.fontWeight);
        const patchedProps = { ...props, style: [{ fontFamily }, props.style] };
        return original.apply(this, [patchedProps, ...args.slice(1)]);
      }
    } catch {
      // fall through to the unmodified render
    }
    return original.apply(this, args);
  };
  TextAny.__detourFontPatched = true;
}
