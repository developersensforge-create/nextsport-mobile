import re

# Patch Podfile for Xcode 26 / Swift 6.2 compatibility
# Must run AFTER expo prebuild (regenerates Podfile), BEFORE pod install

podfile_path = 'ios/Podfile'
with open(podfile_path) as f:
    podfile = f.read()

print("=== Original Podfile head ===")
print(podfile[:300])
print("=== End head ===")

# ── Step 1: Enable modular headers for ExpoModulesJSI ────────────────────────
# Use install! :modular_headers so CocoaPods generates a proper module map.
if ":modular_headers => {'ExpoModulesJSI' => true}" not in podfile:
    if "install! 'cocoapods'" in podfile:
        old_install = re.search(r"install! 'cocoapods'[^\n]*", podfile)
        if old_install:
            old_line = old_install.group(0)
            new_line = old_line + ", :modular_headers => {'ExpoModulesJSI' => true}"
            podfile = podfile.replace(old_line, new_line, 1)
            print("Podfile: appended :modular_headers to existing install! line")
    else:
        podfile = "install! 'cocoapods', :modular_headers => {'ExpoModulesJSI' => true}\n" + podfile
        print("Podfile: inserted install! line with :modular_headers at top")
else:
    print("Podfile: ExpoModulesJSI modular_headers already set, skipping")

# ── Step 2: Xcode 26 build settings in post_install ──────────────────────────
# IMPORTANT: ExpoModulesJSI requires swift_version = '6.0' (set in its podspec).
# We must NOT override SWIFT_VERSION for ExpoModulesJSI target — if we do,
# the module fails to compile and Swift cannot import it ("no such module" error).
# All other pod targets get SWIFT_VERSION = '5.9' to avoid Swift 6 concurrency errors.

xcode26_patch = """
    # ── Xcode 26 / Swift 6.2 compatibility ──────────────────────────────────────
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'
        config.build_settings['CLANG_ENABLE_EXPLICIT_MODULES'] = 'NO'
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        # ExpoModulesJSI podspec declares swift_version = '6.0' — do NOT override it
        # or the module fails to compile and becomes unimportable from Swift.
        unless target.name == 'ExpoModulesJSI'
          config.build_settings['SWIFT_VERSION'] = '5.9'
        end
      end
    end
    installer.generated_projects.each do |project|
      project.build_configurations.each do |config|
        config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'
        config.build_settings['CLANG_ENABLE_EXPLICIT_MODULES'] = 'NO'
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
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
        old_post = "  post_install do |installer|\n    react_native_post_install("
        new_post = "  post_install do |installer|\n" + xcode26_patch + "    react_native_post_install("
        podfile = podfile.replace(old_post, new_post)
        print("Podfile: Xcode 26 patch applied (before react_native_post_install — fallback)")
else:
    print("Podfile: build settings already patched, skipping")

with open(podfile_path, 'w') as f:
    f.write(podfile)

print("Podfile: all patches done")
