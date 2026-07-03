import re

# Patch Podfile for Xcode 26 / Swift 6.2 compatibility
# Must run AFTER expo prebuild (regenerates Podfile), BEFORE pod install
#
# Root cause of "cannot find type 'UIView' in scope" errors:
# Xcode 26 enables SWIFT_ENABLE_EXPLICIT_MODULES=YES by default.
# This means each Swift compilation unit must explicitly import all its dependencies.
# expo-modules-core 55.x Swift files rely on transitive/implicit imports (no "import UIKit"
# at top of file), which breaks with explicit modules enabled.
#
# react_native_post_install() would set SWIFT_ENABLE_EXPLICIT_MODULES=NO — but ONLY when
# !build_rncore_from_source(). RN 0.83 builds from source (build_from_source=true by default),
# so that branch is skipped entirely. We must set it ourselves.
podfile_path = 'ios/Podfile'
with open(podfile_path) as f:
    podfile = f.read()

xcode26_patch = """
    # ── Xcode 26 / Swift 6.2 compatibility ──────────────────────────────────────
    # SWIFT_ENABLE_EXPLICIT_MODULES=NO: disables Xcode 26's new "explicit modules"
    # feature that requires every Swift file to explicitly import UIKit/Foundation etc.
    # expo-modules-core 55.x relies on implicit/transitive imports — this is the root
    # cause of "cannot find type 'UIView' in scope" errors.
    # react_native_post_install normally sets this, but only when building RN from
    # prebuilt binaries (!build_rncore_from_source). RN 0.83 builds from source, so
    # that branch is skipped. We set it unconditionally here.
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

# Insert AFTER react_native_post_install() call, so our settings win over RN's.
# react_native_post_install() sets SWIFT_ENABLE_EXPLICIT_MODULES=NO only when
# !build_rncore_from_source() — which is false for RN 0.83 (builds from source).
# So it sets YES (or leaves it as Xcode 26 default YES). We override AFTER it runs.
old_end = "    react_native_post_install(\n      installer,\n      config[:reactNativePath],\n      :mac_catalyst_enabled => false,\n      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n  end\nend"
new_end = "    react_native_post_install(\n      installer,\n      config[:reactNativePath],\n      :mac_catalyst_enabled => false,\n      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n" + xcode26_patch + "  end\nend"

if 'SWIFT_ENABLE_EXPLICIT_MODULES' not in podfile:
    if old_end in podfile:
        podfile = podfile.replace(old_end, new_end)
        with open(podfile_path, 'w') as f:
            f.write(podfile)
        print("Podfile: Xcode 26 SWIFT_ENABLE_EXPLICIT_MODULES patch applied OK (after react_native_post_install)")
    else:
        # Fallback: insert before react_native_post_install
        old_post = "  post_install do |installer|\n    react_native_post_install("
        new_post = "  post_install do |installer|\n" + xcode26_patch + "    react_native_post_install("
        podfile = podfile.replace(old_post, new_post)
        with open(podfile_path, 'w') as f:
            f.write(podfile)
        print("Podfile: Xcode 26 patch applied (before react_native_post_install — fallback)")
else:
    print("Podfile: already patched, skipping")
