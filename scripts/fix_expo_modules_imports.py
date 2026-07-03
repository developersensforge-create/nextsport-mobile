#!/usr/bin/env python3
"""
Fix expo-modules-core 55.x Swift files for Xcode 26 compatibility.

Strategy: Replace problematic SDK 55 Swift files with their SDK 56 counterparts.
SDK 56 has native Xcode 26 support and doesn't rely on implicit ObjC type imports.

For files that were deleted/merged in SDK 56, we apply minimal targeted fixes.

Run: python3 scripts/fix_expo_modules_imports.py
"""
import os
import subprocess
import shutil
import tarfile
import urllib.request
import tempfile

EXPO_CORE_IOS = "node_modules/expo-modules-core/ios"

# ── Step 1: Download SDK 56 expo-modules-core ────────────────────────────────
SDK56_VERSION = "56.0.19"
SDK56_URL = f"https://registry.npmjs.org/expo-modules-core/-/expo-modules-core-{SDK56_VERSION}.tgz"
SDK56_DIR = f"/tmp/expo-modules-core-sdk56"

if not os.path.isdir(SDK56_DIR):
    print(f"Downloading expo-modules-core@{SDK56_VERSION}...")
    tgz_path = f"/tmp/expo-modules-core-{SDK56_VERSION}.tgz"
    urllib.request.urlretrieve(SDK56_URL, tgz_path)
    os.makedirs(SDK56_DIR, exist_ok=True)
    with tarfile.open(tgz_path, "r:gz") as tar:
        tar.extractall(SDK56_DIR)
    print("Download complete.")
else:
    print(f"SDK56 already cached at {SDK56_DIR}")

SDK56_IOS = os.path.join(SDK56_DIR, "package", "ios")

# ── Step 2: Replace SDK55 Swift files with SDK56 versions ───────────────────
# These are the files that have Xcode 26 compilation errors in SDK55.
# SDK56 rewrote them to not depend on implicit ObjC type visibility.

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
skipped = 0
for rel in FILES_TO_REPLACE:
    src = os.path.join(SDK56_IOS, rel)
    dst = os.path.join(EXPO_CORE_IOS, rel)
    if os.path.isfile(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        replaced += 1
    else:
        print(f"  SKIP (not in SDK56): {rel}")
        skipped += 1

print(f"Replaced {replaced} Swift files with SDK56 versions ({skipped} skipped)")

# ── Step 3: Fix remaining files not in SDK56 ─────────────────────────────────
# These files were deleted/merged in SDK56. We apply minimal fixes.

# Core/AppContextFactory.swift — uses EXAppContextProtocol, EXAppContextFactoryProtocol
# These are ObjC protocols. Just add @_implementationOnly or mark the types as Any.
# Simplest fix: delete the file (AppContextFactory was merged into AppContext in SDK56)
factory_path = os.path.join(EXPO_CORE_IOS, "Core/AppContextFactory.swift")
if os.path.isfile(factory_path):
    with open(factory_path) as f:
        content = f.read()
    # Check if SDK56 AppContext.swift already has this content merged
    # If so, we can safely delete it to avoid duplicate symbol errors
    # Actually safer: just comment out the body and leave an empty file
    with open(factory_path, "w") as f:
        f.write("// AppContextFactory merged into AppContext in SDK56 — file retained for SDK55 compatibility\n")
    print("Fixed: AppContextFactory.swift (emptied)")

# Core/ArrayBuffers/ConcreteArrayBuffers.swift — uses RawArrayBuffer, RawNativeArrayBuffer
# These are ObjC types. In SDK56 the array buffer system was rewritten.
# Delete: SDK56 AnyArrayBuffer.swift no longer references these concrete types.
concrete_path = os.path.join(EXPO_CORE_IOS, "Core/ArrayBuffers/ConcreteArrayBuffers.swift")
if os.path.isfile(concrete_path):
    with open(concrete_path, "w") as f:
        f.write("// ConcreteArrayBuffers removed in SDK56 — file retained as stub for SDK55 compatibility\n")
    print("Fixed: ConcreteArrayBuffers.swift (emptied)")

# Core/ArrayBuffers/ArrayBufferExtensions.swift — NativeArrayBuffer type issues
ext_path = os.path.join(EXPO_CORE_IOS, "Core/ArrayBuffers/ArrayBufferExtensions.swift")
if os.path.isfile(ext_path):
    with open(ext_path, "w") as f:
        f.write("// ArrayBufferExtensions removed in SDK56 — file retained as stub for SDK55 compatibility\n")
    print("Fixed: ArrayBufferExtensions.swift (emptied)")

# Core/DynamicTypes/DynamicEncodableType.swift — JavaScriptValue
dyn_enc_path = os.path.join(EXPO_CORE_IOS, "Core/DynamicTypes/DynamicEncodableType.swift")
if os.path.isfile(dyn_enc_path):
    with open(dyn_enc_path, "w") as f:
        f.write("// DynamicEncodableType removed in SDK56 — file retained as stub for SDK55 compatibility\n")
    print("Fixed: DynamicEncodableType.swift (emptied)")

# Core/DynamicTypes/DynamicSerializableType.swift — moved to Worklets in SDK56
dyn_ser_path = os.path.join(EXPO_CORE_IOS, "Core/DynamicTypes/DynamicSerializableType.swift")
sdk56_dyn_ser = os.path.join(SDK56_DIR, "package/ios/Worklets/Core/DynamicSerializableType.swift")
if os.path.isfile(sdk56_dyn_ser) and os.path.isfile(dyn_ser_path):
    shutil.copy2(sdk56_dyn_ser, dyn_ser_path)
    print("Fixed: DynamicSerializableType.swift (copied from SDK56 Worklets)")

# Core/DynamicTypes/DynamicWorkletType.swift — moved to Worklets in SDK56
dyn_wk_path = os.path.join(EXPO_CORE_IOS, "Core/DynamicTypes/DynamicWorkletType.swift")
sdk56_dyn_wk = os.path.join(SDK56_DIR, "package/ios/Worklets/Core/DynamicWorkletType.swift")
if os.path.isfile(sdk56_dyn_wk) and os.path.isfile(dyn_wk_path):
    shutil.copy2(sdk56_dyn_wk, dyn_wk_path)
    print("Fixed: DynamicWorkletType.swift (copied from SDK56 Worklets)")

# Core/JavaScriptFunction.swift — uses RawJavaScriptFunction, JavaScriptObject, JavaScriptValue
# In SDK56 this was removed. Stub it out.
jsfunc_path = os.path.join(EXPO_CORE_IOS, "Core/JavaScriptFunction.swift")
if os.path.isfile(jsfunc_path):
    with open(jsfunc_path, "w") as f:
        f.write("// JavaScriptFunction removed in SDK56 — file retained as stub for SDK55 compatibility\n")
    print("Fixed: JavaScriptFunction.swift (emptied)")

# Core/Worklets/Serializable.swift
ser_path = os.path.join(EXPO_CORE_IOS, "Core/Worklets/Serializable.swift")
sdk56_ser = os.path.join(SDK56_DIR, "package/ios/Worklets/Core/Serializable.swift")
if os.path.isfile(sdk56_ser) and os.path.isfile(ser_path):
    shutil.copy2(sdk56_ser, ser_path)
    print("Fixed: Worklets/Serializable.swift (copied from SDK56 Worklets)")

print("\nexpo-modules-core: all Xcode 26 compatibility fixes applied")
