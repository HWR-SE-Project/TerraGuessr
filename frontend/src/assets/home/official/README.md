These assets were created with the built-in imagegen tool using the supplied TerraGuessr screenshot as a reference. They are reconstructions, not original source exports. The existing project character was inspected first; its material, face and outfit differed more from the reference than the generated replacement.

`earth-horizon.webp`: 1765 × 891, WebP quality 94.

Final prompt:

> Use case: precise-object-edit. Produce ONLY the clean full-screen background plate of the supplied TerraGuessr screenshot, wide landscape 2:1. Remove ALL user interface: all typography, navigation, sidebar cards, premium card, buttons, and the central character. Reconstruct their underlying background seamlessly. Preserve the original Earth's exact composition: a huge curved photorealistic Earth filling the bottom 39% of the image, the top of the curved horizon at x=50%, y=61.5%, the horizon meeting the left edge at y=92%, the right edge at y=112%. Europe and UK visible in lower center-right, Atlantic ocean lower left, clouds and realistic land. Bright thin pale blue atmospheric rim, warm white sunrise at x=74%, y=72%. Upper 60% clean very dark navy charcoal #141c24 with a soft blue atmospheric glow above the horizon. Very faint topographic contour lines across the upper dark area as in the reference. No stars. Exact background composition of reference, no UI, no character, no text, no icons, no watermarks. Keep Earth's apex at y=61.5%, no higher.

`alpine-lake.webp`: downsampled to 960px wide, WebP quality 93.

Final prompt:

> Use case: precise-object-edit. Asset type: premium card landscape image. Extract and reconstruct ONLY the mountain lake photograph shown in the upper part of the premium card on the RIGHT of this reference screenshot. Fill the entire new image with that landscape. Wide 1.9:1 landscape: a majestic Swiss alpine mountain range with jagged snowcapped peaks, distant blue mountain valley, calm deep blue lake extending diagonally into center distance, green evergreen forests on near slopes, pale pink sunset clouds and blue sky. Match that exact scene, camera and subdued cinematic colors as closely as possible. Remove the white location pin and brackets and all UI. No text, no borders, no icons. High quality photorealistic landscape.

`explorer.webp`: transparent RGBA, downsampled to 512 × 768, WebP quality 95. Initial generation used the supplied screenshot:

> Use case: background-extraction. Asset type: transparent PNG character for the TerraGuessr homepage. Extract and faithfully reconstruct ONLY the central 3D cartoon character in the supplied screenshot. Absolutely no background, earth, buttons, text or other objects. Match the screenshot character precisely: cute tiny full body young explorer, large head, smooth warm tan skin, black chunky side-swept dreadlocks covering right eye and sticking out to the right, shiny small oval black eyes, tiny simple curved smile, blue and white horizontal striped sleeveless tank top, khaki slim trousers, tiny tan rounded bare-looking shoes. Arms relaxed down and slightly out. Smooth polished clay-like 3D mobile game rendering, not fabric texture, no lashes, no belt, no dark boots. Front view, slight turn to the left exactly as reference. Whole figure visible centered with minimal padding, keep head-to-body proportions and exact hairstyle and outfit from screenshot. Neutral expression. True transparent background, no shadow ellipse beneath feet, no UI.

The final refinement used that generated character as its input:

> Use case: background-extraction. Keep the exact character unchanged pixel for pixel. Remove ALL the blurry glow/halo/cloud behind and around the character, especially the gray halo around hair and orange brown glow behind arms and legs. All pixels outside the solid character silhouette must be alpha zero. Sharp clean transparent cutout, no background of any kind, no glow, no shadow. Do not change hairstyle face clothes proportions lighting pose framing. Output the same full-body character as a clean transparent PNG.

No third-party asset URLs are required at runtime. SVG icons are local React components; the logo is live styled text. The profile avatar uses the real account initial because the user contract has no avatar URL. The global Inter font loader is the existing application font loader.
