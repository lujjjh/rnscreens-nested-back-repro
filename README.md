# Android nested native-stack back-state reproduction

Small standalone Expo / React Navigation app, with no application-specific native code.
Pinned to React Native 0.86.3 and react-native-screens **main at `52863ce2dd1dc2484f78fc5088ff0254785fdb43`**
via an immutable GitHub source tarball in package.json and pnpm-lock.yaml. This commit
already contains [upstream #4498](https://github.com/software-mansion/react-native-screens/pull/4498).
The checkout declares package version `1000.0.0`; the SHA is the version identity.

The same parent-detach failure was also verified on published **4.30.0**, the latest
stable version at validation time (2026-10-14), and **4.29.0**. In both 4.30.0 and the
pinned main commit, the proposed guard removes the exception under the same injection.

The suspected uncovered case is a child header whose **own** stack is valid, but whose
parent screen has left its stack. `canNavigateBack()` recurses into that parent.
The header guard introduced by #4498 only checks the child's stack.

## Install and run on Android

```sh
pnpm install --frozen-lockfile
pnpm exec expo prebuild --platform android --no-install
pnpm start
# Separate terminal; choose your Android device explicitly:
pnpm exec expo run:android --device <device-id> --port 8097
```

New Architecture / Fabric and Hermes are enabled by the Expo 57 native template.
The app has its own ID (`com.example.nestedbackrepro`) and does not touch another app's data.

## A. Normal navigation (no native changes)

Tap **Stress parent pop (100 cycles)** or **Stress parent reset (100 cycles)**.
Each cycle mounts a nested native stack, repeatedly changes the child's native header,
and pops or resets the outer stack. Individual navigation buttons are also available.

This is a candidate natural reproduction/stress scenario, not a guaranteed reproduction.
See `evidence/RESULTS.md` for actual observed results.

## B. Deterministic fault injection

This follows the A/B technique documented in #4498 itself: force the transient detached
state inside the native header update. Here it detaches the **parent**, not the screen
whose header is updating. This is explicitly fault injection, not natural navigation.

```sh
python3 scripts/native-variant.py inject
# Rebuild and reinstall; Metro reload alone cannot change native code:
pnpm exec expo run:android --device <device-id> --port 8097
```

1. Tap **Open nested stack**.
2. Tap **Optional: inject parent detach (requires native variant)**.
3. Observe the recursive `canNavigateBack()` exception / debug error screen, despite the #4498 guard.

The Fragment parent relationship is created by React Navigation / FragmentManager,
not reflection. The injection only changes the ancestor's `screen.container` to null;
the child header remains mounted and its own stack is untouched. This proves behavior
in the detached state; it does not prove how often normal navigation reaches that state.

## C. Proposed guard with the same injection

```sh
python3 scripts/native-variant.py inject-fixed
pnpm exec expo run:android --device <device-id> --port 8097
```

Repeat B. `canNavigateBack()` returns false for a detached/dismissed fragment, retains
the assertion for an actual non-stack container, and keeps live-stack recursion.

Restore the published library source with:

```sh
python3 scripts/native-variant.py original
```

Rebuild after every native variant change. The script automatically locates main’s `legacy/` implementation and saves pristine
files under `.native-originals/`, keyed by package version and resolved package path.

## Included evidence

- `evidence/RESULTS.md`: exact observed outcomes and limits.
- `evidence/main/injected-original.png` / `injected-fixed.png`: main before/after UI.
- `evidence/4.30.0/`: latest stable A/B logs.
- Root-level evidence logs/screenshots: earlier 4.29.0 validation.
- `evidence/*.log`: process logs and the 200 completed navigation cycles.
- `proposed-fix.diff`: the small library fix, without test injection.

The default source uses the unmodified published library. Native variants are opt-in.
Always rebuild after switching variants; Metro reload cannot update native code.
