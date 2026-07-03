import re

# Patch Podfile for Xcode 26 compatibility
# Must run AFTER expo prebuild (which regenerates Podfile), BEFORE pod install
podfile_path = 'ios/Podfile'
with open(podfile_path) as f:
    podfile = f.read()

# Comprehensive Xcode 26 fix:
# - SWIFT_STRICT_CONCURRENCY=minimal: suppress Swift 6 strict concurrency errors
# - SWIFT_VERSION=5.9: stay on Swift 5.x semantics (avoids Swift 6 breaking changes)
# - ENABLE_MODULE_VERIFIER=NO: disables strict module verification in Xcode 26
# - CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES=YES: allows expo-modules-core
#   Swift files to reference UIKit/Foundation/CGFloat types without explicit imports
# - DEFINES_MODULE=YES: ensures each pod defines a proper module map
xcode26_patch = """
    # Xcode 26 compatibility fixes for expo-modules-core and React Native pods
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        config.build_settings['SWIFT_VERSION'] = '5.9'
        config.build_settings['ENABLE_MODULE_VERIFIER'] = 'NO'
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        config.build_settings['DEFINES_MODULE'] = 'YES'
        config.build_settings['CLANG_MODULES_AUTOLINK'] = 'YES'
      end
    end
    installer.generated_projects.each do |project|
      project.build_configurations.each do |config|
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        config.build_settings['SWIFT_VERSION'] = '5.9'
        config.build_settings['ENABLE_MODULE_VERIFIER'] = 'NO'
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
"""

old_post = "  post_install do |installer|\n    react_native_post_install("
new_post = "  post_install do |installer|\n" + xcode26_patch + "    react_native_post_install("

if 'ENABLE_MODULE_VERIFIER' not in podfile:
    podfile = podfile.replace(old_post, new_post)
    with open(podfile_path, 'w') as f:
        f.write(podfile)
    print("Podfile: Xcode 26 compatibility patch applied OK")
else:
    print("Podfile: already patched, skipping")
