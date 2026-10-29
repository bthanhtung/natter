# App icon sources

- `icon-mac.svg`: macOS icon on Apple's grid — an 824 × 824 squircle (corner radius 185) centred on a 1024 × 1024 canvas with the standard drop shadow. Without that margin the icon looks larger than other apps in the Dock and in ⌘-Tab.
- `icon-full.svg`: the same art full-bleed, for Windows, Linux and mobile, where the system adds no margin.

Regenerate:

```sh
# render each SVG to a 1024 × 1024 PNG with a transparent background (e.g. Chrome headless), then
npx tauri icon icon-full.png -o src-tauri/icons           # .ico, .png and mobile sizes
mkdir mac.iconset && for s in 16 32 128 256 512; do
  sips -z $s $s icon-mac.png --out mac.iconset/icon_${s}x${s}.png
  sips -z $((s*2)) $((s*2)) icon-mac.png --out mac.iconset/icon_${s}x${s}@2x.png
done
iconutil -c icns mac.iconset -o src-tauri/icons/icon.icns
```
