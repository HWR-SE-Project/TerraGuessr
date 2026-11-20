# Avatar editor

The Home **Edit Avatar** button opens Explorer Studio, a native modal dialog with an actual animated GLB preview. Draft changes stay inside the editor. Save updates the Home character immediately; Cancel/Escape discard the draft. Reset changes the draft only.

## Asset inspection

Source: `frontend/src/assets/home/scene/puppet-kid.glb` (unchanged).

Hierarchy: `Sketchfab_model → 2ab5a54e0de8404ab8056003d6acf768.fbx → Object_2 → RootNode → Puppet Kid Armature → Object_5`. `Object_5` contains the skin, render meshes, and authoring transforms. The nodes called `head`, `body`, `eyebrows`, `eyes`, `hair`, `mouth`, `slippers`, `shirt`, and `shorts` directly under `RootNode` are **empty placeholders**, not the render meshes.

There are 18 skinned render meshes: nine surfaces and nine black outline meshes, sharing one skin with 31 joints. The head rig is `Spine2_04 → Neck_05 → Head_06 → HeadTop_End_07`; Home's existing world-space additive gaze system remains in use.

| Part | Surface mesh node | Outline node | Capability |
| --- | --- | --- | --- |
| Head | Object_38 | Object_39 | Preserved |
| Body/skin | Object_41 | Object_42 | Preserved |
| Eyebrows | Object_44 | Object_45 | Coordinated with hair color |
| Eyes | Object_47 | Object_48 | Colored inner eye region; whites preserved |
| Hair | Object_50 | Object_51 | Hair color |
| Mouth | Object_53 | Object_54 | Preserved |
| Slippers | Object_56 | Object_57 | Footwear color |
| Shirt | Object_59 | Object_60 | Shirt color |
| Shorts | Object_62 | Object_63 | Shorts color |

All nine surfaces use `puppet_material`: a shared double-sided metallic/roughness material, one embedded 256×256 PNG palette atlas assigned to **both base color and emissive map**, and emissive factor approximately 0.96. Outlines use the separate black `Outline_Material`. No morph targets, accessory meshes, alternate clothes, alternate hairstyles, or facial presets are present.

The eye UV islands occupy distinct horizontal atlas columns: the outer white surface is around U=0.472, the dark inner eye is around U=0.911. The color shader masks only the latter. Both diffuse and emissive samples are tinted, retaining the original UV gradient, geometry, outlines, and lighting. `null` colors bypass the tint entirely for the authored appearance. Editable materials are cloned per avatar and per surface; textures and geometry stay shared and are never mutated.

Original animation clips are Idle (1.967 s), Walk (0.967 s), Run (0.533 s), Jump (0.967 s), and Rig Test (12.967 s). Both renderers use the original looping Idle, through the same model/animation hook. No clips are rewritten. The editor uses orbit controls without additive gaze; Home continues its original head tracking. Reduced motion pauses animation and gaze.

## Code and storage

`frontend/src/features/avatar/` separates configuration validation, storage, model preparation, material bindings, UI, and preview. Model cloning and material creation happen atomically, including under React Strict Mode. Materials and cloned skeletons are owned by each instance and disposed on unmount. Cached GLTF geometry and texture assets remain owned by the loader.

Version 1 stores only `hairColor`, `eyeColor`, `shirtColor`, `pantsColor`, and `shoeColor`, each a six-digit hex color or null. Presets and a native color input use the same configuration.

Guests: `terraguessr.avatar.guest.v1` in localStorage. Account users: authenticated GET/PATCH `/api/auth/avatar`, backed by nullable JSONB `UserPreference.avatarConfig`. The PATCH endpoint uses the existing cookie session and same-site mutation protection, validates version/colors, and derives ownership exclusively from the session. Existing preference updates leave avatar data intact. Account saves never fall back to a misleading local success. Failed loading blocks saving and provides Retry; failed saving retains the draft. Signing out restores the independent guest appearance.

Apply migrations and regenerate Prisma before running the updated backend:

```sh
cd backend
npx prisma generate
npx prisma migrate deploy
npm run build
```

For the local Docker stack, rebuilding the backend applies migrations automatically through its existing startup command.

## Verification

Unit tests cover validation, corrupt guest storage, write failures, server failures, and account/local isolation. The auth integration suite covers database round trips, new sign-in restoration, separate account ownership, unauthenticated access, invalid configurations, and cross-site rejection.

`e2e/avatar.spec.ts` runs against the Vite frontend. It inspects real GLB instances and shader bindings through R3F's development module, reads rendered WebGL pixels, checks geometry identity, verifies Idle mixer progression and head motion, exercises camera drag/rotation/zoom, Cancel/Save/Reset/refresh, keyboard focus, mobile/tablet and small effective viewport behavior. No debugging globals or application test hooks are installed.

For account browser tests, point `AVATAR_TEST_API_URL` at an isolated backend with migrated Postgres and development auto-verification (no SMTP). Browser API requests are forwarded there without changing the shared Vite proxy:

```sh
AVATAR_TEST_API_URL=http://localhost:3017 npm run test:e2e -- e2e/avatar.spec.ts
```

Reference captures are in `docs/screenshots/avatar/`.
