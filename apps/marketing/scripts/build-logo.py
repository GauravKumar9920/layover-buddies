"""Outline the existing Detour brand fonts; no browser font loading required."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
root=Path(__file__).resolve().parents[3]
fonts=root/'design/brand/canvas-fonts'
out=root/'apps/marketing/public/brand'
out.mkdir(exist_ok=True)
parts=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 274 74" fill="none">','<g transform="translate(0 1) scale(.82)"><path d="M8 60C26 60 34 56 46 50" stroke="#0E1929" stroke-width="3.4" stroke-linecap="round" stroke-dasharray=".5 8"/><circle cx="8" cy="60" r="4.5" fill="#2D7BA9"/><path d="M58 60C50 49 43 43 43 33a15 15 0 1130 0c0 10-7 16-15 27Z" fill="#C8542A"/><circle cx="58" cy="33" r="5.4" fill="#FCF7EA"/></g>']
x=75
for text,file,color in [('Det','BricolageGrotesque-Bold.ttf','#0E1929'),('ou','InstrumentSerif-Italic.ttf','#C8542A'),('r','BricolageGrotesque-Bold.ttf','#0E1929')]:
 f=TTFont(fonts/file);gs=f.getGlyphSet();cmap=f.getBestCmap();scale=52/f['head'].unitsPerEm
 for c in text:
  name=cmap[ord(c)];pen=SVGPathPen(gs);gs[name].draw(TransformPen(pen,(scale,0,0,-scale,x,53)));parts.append(f'<path d="{pen.getCommands()}" fill="{color}"/>');x+=gs[name].width*scale-1.2
parts.append('</svg>')
(out/'detour-logo.svg').write_text(''.join(parts))
(out/'detour-logo-light.svg').write_text(''.join(parts).replace('#0E1929','#FCF7EA'))
(out/'detour-mark.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#F4EDDD"/><path d="M10 49Q25 50 32 40" fill="none" stroke="#0E1929" stroke-width="3" stroke-linecap="round" stroke-dasharray=".5 6"/><circle cx="10" cy="49" r="3" fill="#2D7BA9"/><path d="M40 49C32 39 26 33 26 25a14 14 0 1128 0c0 8-6 14-14 24Z" fill="#C8542A"/><circle cx="40" cy="25" r="5" fill="#FCF7EA"/></svg>')
print('Exported outlined Detour logos and favicon.')
