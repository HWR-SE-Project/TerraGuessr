# Earth textures

The active renderer uses `earth-day-4k.webp` (or `earth-day-2k.webp` on mobile) and `earth-clouds-2k.webp`, by [Solar System Scope](https://www.solarsystemscope.com/textures/)
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Source URLs and modifications are recorded in `frontend/public/asset-credits.txt`,
linked from the Home footer. Textures were downloaded from the publisher and
optimized locally. No third-party texture requests occur at runtime.

The older underscored textures remain as checkpointed project assets; the active
scene no longer imports them.

## Home character

`puppet-kid.glb` is a byte-for-byte copy of the user-supplied
`puppet_kid_free_demo.glb` in the application root. It is **Puppet Kid (Free Demo)**
by [joaobaltieri](https://sketchfab.com/joaobaltieri), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
[Original model](https://sketchfab.com/3d-models/puppet-kid-free-demo-b30af4c13ef64e9cab15cf2bd437a435).

No geometry, texture, material, skeleton, or animation data was rewritten.
The source is already small (1,078,228 bytes, 9,272 triangles, 5,456 vertices,
one 256 × 256 PNG atlas, two shared materials). Its five clips are Idle, Walk,
Run, Jump, and Rig Test; the Home scene plays Idle. The original emissive,
metallic and outline materials are preserved, including GLTFLoader's sRGB
configuration for color/emissive maps. Only the skeleton hierarchy is cloned.

The 31-joint rig is Y-up and faces +Z. Bind bounds are approximately
1.342 × 1.942 × 1.251 units. The renderer samples the actual skinned Idle
bounds once, centers that envelope, and uniformly fits it to the existing
responsive avatar slot. An orthographic foreground pass uses the existing
canvas/WebGL context, avoiding intersections with the cinematic Earth.
Local, cached softbox environment lighting requires no remote HDRI.

### Cursor tracking

`useHeadTracking.ts` layers gaze onto the authored Idle pose using the actual
`Head_06` and `Neck_05` bones (80% head / 20% neck). There are no separate eye
bones or morph controls, so the original eyes follow the skinned head.
`Neck_05` has approximately -60° local X at rest; `Head_06` counter-rotates it.
The layer converts model-space offsets through each animated parent frame,
rather than replacing their local Euler angles or the bind pose.

Mouse coordinates are normalized against the actual canvas bounds and
unprojected through the character's orthographic camera to an eye-height target
plane. Yaw is limited to ±30° and pitch to ±15°, with exponential damping (6/s).
The authored pose is restored before the mixer update; the gaze is applied
after the mixer and before rendering. No torso or root rotation follows the
pointer. Pointer exit, window blur, or a hidden document returns gaze to neutral.
Touch does not activate gaze; reduced motion pauses Idle at its current phase
and disables tracking. Playback resumes from that phase without resetting.
Mutable pointer/angle refs and reused math objects
avoid React renders and allocations in the animation loop. Active tracking is
scheduled at up to 60fps; settled Idle returns to 30fps. Hidden tabs do not
schedule renders. Skeleton clones and local environment render targets are
released on unmount; shared GLTF cache assets are retained for navigation.

### Embedded body animation playback

The Home character explicitly plays `Idle` (1.966667 seconds) with
`LoopRepeat`, infinite repetitions, full weight, and 1× time scale using the
existing Drei playback mixer. Startup is independent of status callbacks and
motion preferences. Visible frames use the original elapsed time; the first
frame after a hidden-tab or reduced-motion pause discards stale elapsed time
without seeking or restarting the action.

The source Idle has subtle spine, forearm and left-hand movement, plus its
own head animation. Legs and feet are largely stationary in this clip; the
larger locomotion/jump/rig-test motions belong to other clips. No procedural
body motion or exaggeration is added. Head tracking still restores the authored
head/neck pose before the mixer and layers gaze after it, preserving both.

Browser recording, frame captures, source-clip comparisons, timing and loop
verification are in `docs/screenshots/character-body/` at the application root.
