# Current main and latest stable verification — 2026-10-14

Default dependency: upstream main `52863ce2dd1dc2484f78fc5088ff0254785fdb43`, fetched as an immutable
GitHub source tarball. Its package.json declares version 1000.0.0. The built Android
class is `com.swmansion.rnscreens.legacy.ScreenStackFragment`, confirming that the
main legacy implementation was exercised rather than the previous published binary.

Environment: Android 16 emulator / arm64, Expo 57.0.25, React Native 0.86.3,
React Navigation native-stack 7.19.2, Fabric/Hermes. Metro was restarted with a cleared
cache after each library version switch; native APKs were rebuilt and installed in place.

| Library | Parent-detach injection | Same injection + proposed guard |
| --- | --- | --- |
| 4.30.0 (latest stable at validation time) | Native exception / debug error screen | No target exception; native back button hidden; Pop Parent returns Home |
| main `52863ce2dd1d` | Native exception / debug error screen | No target exception; native back button hidden; Pop Parent returns Home |

Both baseline builds have the two recursive frames at ScreenStackFragment.kt:510
and :516. Main's header caller is ScreenStackHeaderConfig.kt:300, including injection
lines; 4.30.0's is :299. Logs are in `main/` and `4.30.0/`. Main screenshots show the
before/after UI. Both native app builds and fix builds succeeded against RN 0.86.3.

The injection runs after the #4498 guard and only nulls the ancestor screen's
container. The child stack remains valid and the actual FragmentManager parent
relationship is untouched. **The uncovered lifecycle state is still present in main;
this is a deterministic fault-injection A/B, not a naturally reproduced navigation race.**

No normal-navigation stress test was rerun on 4.30.0 or main. The 200 normal
navigation cycles below were on 4.29.0 only. Do not attribute them to newer versions.

The default source is restored to the original pinned main implementation after
validation; the emulator's last tested APK includes the injected fix. Rebuild the
chosen native variant before testing.

---

## Earlier 4.29.0 validation

Environment: Android 16 emulator (arm64), Expo 57.0.25, React Native 0.86.3,
React Navigation native-stack 7.19.2, react-native-screens 4.29.0, Fabric/Hermes.

| Variant | Action | Result |
| --- | --- | --- |
| Published 4.29.0, no native modifications | 100 parent-pop cycles with changing child header | Completed, no target exception |
| Published 4.29.0, no native modifications | 100 outer-reset cycles with changing child header | Completed, no target exception |
| 4.29.0 + explicit parent-detach injection | Open nested stack, tap injection button | Native exception / React Native debug error screen |
| Same injection + proposed canNavigateBack guard | Same two taps | No target exception; header back button disappears; Pop Parent still returns Home |

The first failing native frames in the injected baseline are:

```
ScreenStackFragment.canNavigateBack(ScreenStackFragment.kt:510)
ScreenStackFragment.canNavigateBack(ScreenStackFragment.kt:516)
ScreenStackHeaderConfig.onUpdate(ScreenStackHeaderConfig.kt:299)
ScreenStackHeaderConfigViewManager.onAfterUpdateTransaction(ScreenStackHeaderConfigViewManager.kt:82)
```

Header line numbers include the test injection. In this debug build React Native
catches the native exception and displays an error screen; the Android process
remains alive. This is not described as a verified release-process crash.

The source already includes #4498's null-stack early return. The injected code runs
**after** that guard. Parent linkage and the mounted header are real, created by
React Navigation / FragmentManager; only the parent's container null state is forced.

Logs and screenshots are in this directory. `injected-fixed.log` includes an
unrelated startup ReactNoCrashSoftException about window focus before the React
context is ready, but not the target IllegalStateException. The injection marker
confirms that the same forced state was exercised in both builds.

The production report was on 4.28.0. The reproduced recursive assertion matches
its two canNavigateBack frames; the caller into onUpdate differs (props update
here versus header-child removal in production). This is a lifecycle-state A/B,
not an exact reproduction of the whole production event sequence.

Normal navigation did not reproduce the bug in these 200 cycles. Do not present
this project as a deterministic pure-JS/user-action crash reproduction.

At the time of this earlier run, main had only been inspected. The new main and
4.30.0 runtime validation at the top of this document supersedes that limitation.
