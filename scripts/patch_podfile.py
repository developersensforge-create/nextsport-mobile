import re

# Patch Podfile: add SWIFT_STRICT_CONCURRENCY=minimal in post_install
# Must run BEFORE pod install
podfile_path = 'ios/Podfile'
with open(podfile_path) as f:
    podfile = f.read()

swift_patch = """
    # Fix Swift concurrency warnings/errors on Xcode 16.x
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        config.build_settings['SWIFT_VERSION'] = '5.0'
      end
    end
"""

old_post = "  post_install do |installer|\n    react_native_post_install("
new_post = "  post_install do |installer|\n" + swift_patch + "    react_native_post_install("

if 'SWIFT_STRICT_CONCURRENCY' not in podfile:
    podfile = podfile.replace(old_post, new_post)
    with open(podfile_path, 'w') as f:
        f.write(podfile)
    print("Podfile: Swift concurrency patch applied OK")
else:
    print("Podfile: already patched, skipping")
