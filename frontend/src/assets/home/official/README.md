`earth-horizon.webp` is the only asset in this directory still in use — it is
the Home page's static fallback (`StaticFallbackScene.tsx`), shown while the
3D scene chunk loads and permanently when WebGL is unavailable. It was created
with the built-in imagegen tool using an early TerraGuessr screenshot as a
reference, and is 1765 × 891, WebP quality 94.

`explorer.webp`, `alpine-lake.webp` and `sky.svg` were part of an earlier
flat-image Home design and have been removed as unused — the character is now
a real rigged GLB (see `../scene/README.md`) and no current page needs a
mountain-lake or sky asset.

No third-party asset URLs are required at runtime. SVG icons are local React
components; the logo is live styled text. The profile avatar uses the real
account initial because the user contract has no avatar URL. The global Inter
font loader is the existing application font loader.
