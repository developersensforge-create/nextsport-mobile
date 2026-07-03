import re

# Patch Podfile for Xcode 26 / Swift 6.2 compatibility
# Must run AFTER expo prebuild (regenerates Podfile), BEFORE pod install
#
# Root cause of "cannot find type 'UIView' in scope" errors:
# Xcode 26 enables SWIFT_ENABLE_EXPLICIT_MODULES=YES by default.
# expo-modules-core 55.x Swift files rely on transitive/implicit imports.
# We fix these directly via fix_expo_modules_imports.py (adding explicit imports).
# For ExpoModulesJSI, the module must be importable from Swift — that requires
# :modular_headers => true at pod install time, NOT just DEFINES_MODULE in post_install.

podfile_path = 'ios/Podfile'
with open(podfile_path) as f:
    podfile = f.read()

print("=== Original Podfile head ===")
print(podfile[:500])
print("=== End head ===")

# ── Step 1: Enable modular headers for ExpoModulesJSI ────────────────────────
# CocoaPods install! block supports per-pod modular_headers.
# If install! already exists, we append :modular_headers to it.
# If not, we insert a new install! line.
# This is the ONLY reliable way to make ExpoModulesJSI importable from Swift.

if ":modular_headers => {'ExpoModulesJSI' => true}" not in podfile:
    if "install! 'cocoapods'" in podfile:
        # Existing install! block — append modular_headers option
        # e.g. install! 'cocoapods', :deterministic_uuids => false
        # becomes: install! 'cocoapods', :deterministic_uuids => false, :modular_headers => {'ExpoModulesJSI' => true}
        old_install = re.search(r"install! 'cocoapods'[^\n]*", podfile)
        if old_install:
            old_line = old_install.group(0)
            new_line = old_line + ", :modular_headers => {'ExpoModulesJSI' => true}"
            podfile = podfile.replace(old_line, new_line, 1)
            print("Podfile: appended :modular_headers to existing install! line")
        else:
            print("WARNING: install! 'cocoapods' found but could not parse line")
    else:
        # No install! block — insert at very top
        podfile = "install! 'cocoapods', :modular_headers => {'ExpoModulesJSI' => true}\n" + podfile
        print("Podfile: inserted install! line with :modular_headers at top")
else:
    print("Podfile: ExpoModulesJSI modular_headers already set, skipping")

# ── Step 2: Xcode 26 build settings in post_install ──────────────────────────
xcode26_patch = """
    # ── Xcode 26 / Swift 6.2 compatibility ──────────────────────────────────────
    # Note: SWIFT_ENABLE_EXPLICIT_MODULES=NO is ignored by Xcode 26.3 entirely.
    # The actual fix for UIKit/Foundation/ExpoModulesJSI import errors is done
    # via scripts/fix_expo_modules_imports.py (adds explicit imports to source files)
    # and via install! :modular_headers for ExpoModulesJSI.
    # These settings below address Swift concurrency warnings only.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'
        config.build_settings['CLANG_ENABLE_EXPLICIT_MODULES'] = 'NO'
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        config.build_settings['SWIFT_VERSION'] = '5.9'
      end
    end
    installer.generated_projects.each do |project|
      project.build_configurations.each do |config|
        config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'
        config.build_settings['CLANG_ENABLE_EXPLICIT_MODULES'] = 'NO'
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        config.build_settings['SWIFT_VERSION'] = '5.9'
      end
    end
    # ────────────────────────────────────────────────────────────────────────────

"""

old_end = "    react_native_post_install(\n      installer,\n      config[:reactNativePath],\n      :mac_catalyst_enabled => false,\n      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n  end\nend"
new_end = "    react_native_post_install(\n      installer,\n      config[:reactNativePath],\n      :mac_catalyst_enabled => false,\n      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n" + xcode26_patch + "  end\nend"

if 'SWIFT_ENABLE_EXPLICIT_MODULES' not in podfile:
    if old_end in podfile:
        podfile = podfile.replace(old_end, new_end)
        print("Podfile: Xcode 26 build settings patch applied (after react_native_post_install)")
    else:
        # Fallback: insert before react_native_post_install
        old_post = "  post_install do |installer|\n    react_native_post_install("
        new_post = "  post_install do |installer|\n" + xcode26_patch + "    react_native_post_install("
        podfile = podfile.replace(old_post, new_post)
        print("Podfile: Xcode 26 patch applied (before react_native_post_install — fallback)")
else:
    print("Podfile: build settings already patched, skipping")

with open(podfile_path, 'w') as f:
    f.write(podfile)

print("Podfile: all patches done")
print("=== Patched Podfile head ===")
with open(podfile_path) as f:
    print(f.read()[:600])
print("=== End ===")
