#!/usr/bin/env python3
"""
Fix expo-modules-core 55.x for Xcode 26 compatibility.

Root cause: Xcode 26 requires explicit module imports. expo-modules-core 55.x relied on
implicit ObjC type visibility which Xcode 26 no longer provides.

Solution:
1. Install expo-modules-jsi@56 (the new standalone Swift package) into node_modules
2. Patch ExpoModulesJSI.podspec to use the SDK56 Swift sources
3. Replace problematic SDK55 Swift files with SDK56 versions (which use `import ExpoModulesJSI`)

This gives us a real Swift ExpoModulesJSI module that SDK56 Swift files can import.
"""
import os
import shutil
import tarfile
import urllib.request

EXPO_CORE = "node_modules/expo-modules-core"
EXPO_CORE_IOS = f"{EXPO_CORE}/ios"
EXPO_MODULES_JSI_DIR = "node_modules/expo-modules-jsi"

# ── Step 1: Download expo-modules-jsi@56.0.11 (standalone Swift package) ─────
JSI56_VERSION = "56.0.11"
JSI56_URL = f"https://registry.npmjs.org/expo-modules-jsi/-/expo-modules-jsi-{JSI56_VERSION}.tgz"
JSI56_CACHE = f"/tmp/expo-modules-jsi-{JSI56_VERSION}"

if not os.path.isdir(JSI56_CACHE):
    print(f"Downloading expo-modules-jsi@{JSI56_VERSION}...")
    tgz = f"/tmp/expo-modules-jsi-{JSI56_VERSION}.tgz"
    urllib.request.urlretrieve(JSI56_URL, tgz)
    os.makedirs(JSI56_CACHE, exist_ok=True)
    with tarfile.open(tgz, "r:gz") as tar:
        tar.extractall(JSI56_CACHE)
    print("Download complete.")
else:
    print(f"expo-modules-jsi@{JSI56_VERSION} already cached")

JSI56_PKG = os.path.join(JSI56_CACHE, "package")
JSI56_APPLE = os.path.join(JSI56_PKG, "apple")
JSI56_SOURCES = os.path.join(JSI56_APPLE, "Sources", "ExpoModulesJSI")

# Install expo-modules-jsi into node_modules (for Podfile reference)
if not os.path.isdir(EXPO_MODULES_JSI_DIR):
    shutil.copytree(JSI56_PKG, EXPO_MODULES_JSI_DIR)
    print(f"Installed expo-modules-jsi@{JSI56_VERSION} into {EXPO_MODULES_JSI_DIR}")
else:
    print(f"expo-modules-jsi already in node_modules")

# ── Step 2: Replace ExpoModulesJSI.podspec with SDK56 version ────────────────
# The SDK55 ExpoModulesJSI.podspec uses ObjC sources from ios/JSI/.
# We replace it with the SDK56 version which uses the new Swift sources.
sdk56_podspec = os.path.join(JSI56_APPLE, "ExpoModulesJSI.podspec")
sdk55_podspec = os.path.join(EXPO_CORE, "ExpoModulesJSI.podspec")

if os.path.isfile(sdk56_podspec):
    # Read SDK56 podspec and fix the path references
    with open(sdk56_podspec) as f:
        content = f.read()
    # SDK56 podspec references '../package.json' but we need to adjust the source path
    # The SDK56 podspec source_files point to Sources/ExpoModulesJSI
    # We'll copy the Swift sources into expo-modules-core/ios/JSI-Swift/ and point there
    swift_dest = os.path.join(EXPO_CORE_IOS, "JSI-Swift")
    if os.path.isdir(swift_dest):
        shutil.rmtree(swift_dest)
    shutil.copytree(JSI56_SOURCES, swift_dest)
    print(f"Copied SDK56 ExpoModulesJSI Swift sources to {swift_dest}")

    # Also copy Cxx sources
    cxx_src = os.path.join(JSI56_APPLE, "Sources", "ExpoModulesJSI-Cxx")
    cxx_dest = os.path.join(EXPO_CORE_IOS, "JSI-Cxx")
    if os.path.isdir(cxx_src):
        if os.path.isdir(cxx_dest):
            shutil.rmtree(cxx_dest)
        shutil.copytree(cxx_src, cxx_dest)
        print(f"Copied SDK56 ExpoModulesJSI-Cxx sources to {cxx_dest}")

    # Copy API notes if present
    apinotes_src = os.path.join(JSI56_APPLE, "APINotes")
    apinotes_dest = os.path.join(EXPO_CORE_IOS, "JSI-APINotes")
    if os.path.isdir(apinotes_src):
        if os.path.isdir(apinotes_dest):
            shutil.rmtree(apinotes_dest)
        shutil.copytree(apinotes_src, apinotes_dest)

    # Write a new ExpoModulesJSI.podspec that uses these Swift sources
    new_podspec = f"""require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoModulesJSI'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = {{ :ios => '15.1' }}
  s.swift_version  = '6.0'
  s.source         = {{ git: 'https://github.com/expo/expo.git' }}
  s.static_framework = true
  s.header_dir     = 'ExpoModulesJSI'

  s.dependency 'hermes-engine'
  s.dependency 'React-Core'
  s.dependency 'ReactCommon'
  s.dependency 'React-runtimescheduler'

  s.source_files = [
    'ios/JSI-Swift/**/*.{{h,m,mm,swift,cpp}}',
    'ios/JSI-Cxx/**/*.{{h,m,mm,cpp}}',
  ]
  s.pod_target_xcconfig = {{
    'DEFINES_MODULE' => 'YES',
    'SWIFT_INCLUDE_PATHS' => '$(PODS_TARGET_SRCROOT)/ios/JSI-Cxx',
  }}
end
"""
    with open(sdk55_podspec, "w") as f:
        f.write(new_podspec)
    print("Patched ExpoModulesJSI.podspec to use SDK56 Swift sources")
else:
    print(f"WARNING: SDK56 podspec not found at {sdk56_podspec}")

# ── Step 3: Download SDK56 expo-modules-core and replace Swift files ──────────
SDK56_VERSION = "56.0.19"
SDK56_URL = f"https://registry.npmjs.org/expo-modules-core/-/expo-modules-core-{SDK56_VERSION}.tgz"
SDK56_CACHE = f"/tmp/expo-modules-core-sdk56"

if not os.path.isdir(SDK56_CACHE):
    print(f"Downloading expo-modules-core@{SDK56_VERSION}...")
    tgz = f"/tmp/expo-modules-core-{SDK56_VERSION}.tgz"
    urllib.request.urlretrieve(SDK56_URL, tgz)
    os.makedirs(SDK56_CACHE, exist_ok=True)
    with tarfile.open(tgz, "r:gz") as tar:
        tar.extractall(SDK56_CACHE)
    print("Download complete.")
else:
    print(f"SDK56 expo-modules-core already cached")

SDK56_IOS = os.path.join(SDK56_CACHE, "package", "ios")

# Files to replace with SDK56 versions
FILES_TO_REPLACE = [
    "Core/AppContext.swift",
    "Core/ArrayBuffers/AnyArrayBuffer.swift",
    "Core/ArrayBuffers/ArrayBuffer.swift",
    "Core/Classes/ClassDefinition.swift",
    "Core/Classes/ClassRegistry.swift",
    "Core/DynamicTypes/AnyDynamicType.swift",
    "Core/DynamicTypes/DynamicArrayBufferType.swift",
    "Core/DynamicTypes/DynamicArrayType.swift",
    "Core/DynamicTypes/DynamicBoolType.swift",
    "Core/DynamicTypes/DynamicDataType.swift",
    "Core/DynamicTypes/DynamicDictionaryType.swift",
    "Core/DynamicTypes/DynamicEitherType.swift",
    "Core/DynamicTypes/DynamicJavaScriptType.swift",
    "Core/DynamicTypes/DynamicNumberType.swift",
    "Core/DynamicTypes/DynamicOptionalType.swift",
    "Core/DynamicTypes/DynamicSharedObjectType.swift",
    "Core/DynamicTypes/DynamicStringType.swift",
    "Core/DynamicTypes/DynamicSwiftUIViewType.swift",
    "Core/DynamicTypes/DynamicTypedArrayType.swift",
    "Core/DynamicTypes/DynamicValueOrUndefinedType.swift",
    "Core/DynamicTypes/DynamicViewType.swift",
    "Core/DynamicTypes/DynamicVoidType.swift",
    "Core/Events/EventObservingDefinition.swift",
    "Core/Events/LegacyEventEmitterCompat.swift",
    "Core/ExpoRuntime.swift",
    "Core/Functions/AsyncFunctionDefinition.swift",
    "Core/Functions/ConcurrentFunctionDefinition.swift",
    "Core/Functions/SyncFunctionDefinition.swift",
    "Core/JSValueEncoder.swift",
    "Core/JavaScriptUtils.swift",
    "Core/Logging/Logger.swift",
    "Core/Logging/PersistentFileLog.swift",
    "Core/MainValueConverter.swift",
    "Core/ModuleHolder.swift",
    "Core/ModuleRegistry.swift",
    "Core/Modules/CoreModule.swift",
    "Core/Modules/ModuleDefinition.swift",
    "Core/Objects/ConstantDefinition.swift",
    "Core/Objects/JavaScriptObjectBuilder.swift",
    "Core/Objects/ObjectDefinition.swift",
    "Core/Objects/PropertyDefinition.swift",
    "Core/Promise.swift",
    "Core/Protocols/AnyViewDefinition.swift",
    "Core/SharedObjects/SharedObject.swift",
    "Core/SharedObjects/SharedObjectRegistry.swift",
    "Core/TypedArrays/AnyTypedArray.swift",
    "Core/TypedArrays/TypedArray.swift",
    "Core/Views/SwiftUI/SwiftUIHostingView.swift",
    "Core/Views/SwiftUI/SwiftUIViewDefinition.swift",
    "Core/Views/SwiftUI/SwiftUIVirtualView.swift",
    "Core/Views/UnimplementedExpoView.swift",
    "Core/Views/ViewDefinition.swift",
    "Core/Worklets/Worklet.swift",
    "Fabric/ExpoFabricView.swift",
    "FileSystemUtilities/FileSystemManager.swift",
    "JS/JavaScriptActor.swift",
    "JS/JavaScriptRuntime.swift",
    "JS/JavaScriptValue.swift",
    "Legacy/LegacyModuleRegistry.swift",
    "Utilities/ConstantsProvider.swift",
    "Api/Factories/ClassFactories.swift",
]

replaced = 0
for rel in FILES_TO_REPLACE:
    src = os.path.join(SDK56_IOS, rel)
    dst = os.path.join(EXPO_CORE_IOS, rel)
    if os.path.isfile(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        replaced += 1
    else:
        print(f"  SKIP (not in SDK56): {rel}")

print(f"Replaced {replaced} Swift files with SDK56 versions")

# Stub out SDK55-only files that SDK56 deleted (would cause duplicate symbols)
stubs = [
    "Core/AppContextFactory.swift",
    "Core/ArrayBuffers/ArrayBufferExtensions.swift",
    "Core/ArrayBuffers/ConcreteArrayBuffers.swift",
    "Core/DynamicTypes/DynamicEncodableType.swift",
    "Core/JavaScriptFunction.swift",
]
for rel in stubs:
    path = os.path.join(EXPO_CORE_IOS, rel)
    if os.path.isfile(path):
        with open(path, "w") as f:
            f.write(f"// {os.path.basename(rel)} removed in SDK56 — stubbed for compatibility\n")
        print(f"Stubbed: {rel}")

# Copy Worklets files from SDK56
worklets_files = [
    ("Worklets/Core/DynamicSerializableType.swift", "Core/DynamicTypes/DynamicSerializableType.swift"),
    ("Worklets/Core/DynamicWorkletType.swift", "Core/DynamicTypes/DynamicWorkletType.swift"),
    ("Worklets/Core/Serializable.swift", "Core/Worklets/Serializable.swift"),
]
for src_rel, dst_rel in worklets_files:
    src = os.path.join(SDK56_IOS, src_rel)
    dst = os.path.join(EXPO_CORE_IOS, dst_rel)
    if os.path.isfile(src):
        shutil.copy2(src, dst)
        print(f"Copied from SDK56 Worklets: {dst_rel}")

print("\nexpo-modules-core: all Xcode 26 fixes applied")
print("ExpoModulesJSI: upgraded to SDK56 Swift module")
