#!/usr/bin/env python3
"""Optional fault injection for the same kind of A/B test used in upstream #4498.
Not needed for the normal navigation stress test. Rebuild Android after switching.
"""
from pathlib import Path
import sys
import hashlib
import json

mode = sys.argv[1] if len(sys.argv) == 2 else ''
if mode not in ('original', 'inject', 'inject-fixed'):
    raise SystemExit('usage: python3 scripts/native-variant.py original|inject|inject-fixed')
package = Path('node_modules/react-native-screens').resolve()
base = package / 'android/src/main/java/com/swmansion/rnscreens'
if (base / 'legacy/ScreenStackFragment.kt').exists():
    base = base / 'legacy'
version = json.loads((package / 'package.json').read_text())['version']
identity = hashlib.sha256(str(package).encode()).hexdigest()[:12]
backup = Path('.native-originals') / f'{version}-{identity}'
backup.mkdir(parents=True, exist_ok=True)
for name in ('ScreenStackHeaderConfig.kt', 'ScreenStackFragment.kt'):
    saved = backup / name
    if not saved.exists():
        saved.write_bytes((base / name).read_bytes())
    (base / name).write_bytes(saved.read_bytes())

if mode != 'original':
    path = base / 'ScreenStackHeaderConfig.kt'
    source = path.read_text()
    marker = '        // hide back button\n'
    injection = '''        // REPRO ONLY: make the transient parent-detach state permanent, as in #4498.
        // The child is mounted by real React Navigation and FragmentManager.
        // Its own stack is untouched, so the #4498 guard above has already passed.
        if (title == "INJECT_PARENT_DETACH") {
            val ancestor = screenFragment?.parentFragment as? ScreenStackFragment
            if (ancestor != null && ancestor.screen.container != null) {
                android.util.Log.e("NestedBackRepro", "Injecting detached PARENT; child stack is still valid")
                ancestor.screen.container = null
            }
        }

'''
    assert source.count(marker) == 1
    path.write_text(source.replace(marker, injection + marker))
if mode == 'inject-fixed':
    path = base / 'ScreenStackFragment.kt'
    source = path.read_text()
    old = '''        val container: ScreenContainer? = screen.container
        check(container is ScreenStack) { "ScreenStackFragment added into a non-stack container" }
'''
    new = '''        val container: ScreenContainer = screen.container ?: return false
        check(container is ScreenStack) { "ScreenStackFragment added into a non-stack container" }
        if (!container.hasScreen(this)) {
            return false
        }
'''
    assert source.count(old) == 1
    path.write_text(source.replace(old, new))
print('Native variant:', mode)
