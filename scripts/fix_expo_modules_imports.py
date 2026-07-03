#!/usr/bin/env python3
"""
Fix expo-modules-core 55.x Swift files for Xcode 26 compatibility.

Backports missing imports from SDK 56 into SDK 55 source files:
  - import UIKit / import Foundation  (for types like UIView, CGFloat, Data)
  - import ExpoModulesJSI             (for JavaScriptValue, ExpoRuntime, etc.)

SDK 56 added these explicit imports to fix Xcode 26 explicit modules mode.
We apply the same fix to SDK 55 so we don't have to upgrade the entire SDK.

Run: python3 scripts/fix_expo_modules_imports.py
"""
import os

EXPO_CORE_IOS = "node_modules/expo-modules-core/ios"

UIKIT_TYPES = [
    "UIView", "UIColor", "UIImage", "UIViewController", "UIApplication",
    "UIGestureRecognizer", "CGFloat", "CGRect", "CGSize", "CGPoint",
    "UIFont", "UIScreen", "UIWindow", "UIDevice", "UIEdgeInsets",
]

FOUNDATION_TYPES = [
    "Data", "JSONDecoder", "JSONEncoder", "URL", "URLRequest",
    "URLSession", "FileManager", "Date", "UUID", "NSObject",
    "NSError", "DispatchQueue",
]

# Files that need ExpoModulesJSI (backported from SDK 56 diff)
EXPO_JSI_FILES = {
    "Api/Factories/ClassFactories.swift",
    "Api/Factories/ConcurrentFunctionFactories.swift",
    "Core/AppContext.swift",
    "Core/ExpoRuntime.swift",
    "Core/JavaScriptUtils.swift",
    "Core/Promise.swift",
    "Core/Conversions.swift",
    "Core/JSValueEncoder.swift",
    "Core/ModuleHolder.swift",
    "Core/MainValueConverter.swift",
    "Core/Functions/SyncFunctionDefinition.swift",
    "Core/Functions/ConcurrentFunctionDefinition.swift",
    "Core/Functions/AnyFunctionDefinition.swift",
    "Core/Functions/AsyncFunctionDefinition.swift",
    "Core/Views/ViewDefinition.swift",
    "Core/SharedObjects/SharedObjectRegistry.swift",
    "Core/SharedObjects/SharedObject.swift",
    "Core/Arguments/AnyArgument.swift",
    "Core/Modules/ModuleDefinition.swift",
    "Core/Modules/CoreModule.swift",
    "Core/TypedArrays/AnyTypedArray.swift",
    "Core/TypedArrays/TypedArray.swift",
    "Core/Classes/ClassDefinition.swift",
    "Core/Classes/ClassRegistry.swift",
    "Core/Records/Record.swift",
    "Core/Records/AnyField.swift",
    "Core/Events/EventObservingDefinition.swift",
    "Core/Objects/ObjectDefinition.swift",
    "Core/Objects/JavaScriptObjectBuilder.swift",
    "Core/Objects/ConstantDefinition.swift",
    "Core/Objects/PropertyDefinition.swift",
    "Core/Protocols/AnyModule.swift",
    "Core/Protocols/AnyViewDefinition.swift",
    "Core/DynamicTypes/AnyDynamicType.swift",
    "Core/DynamicTypes/DynamicDataType.swift",
    "Core/DynamicTypes/DynamicTypedArrayType.swift",
    "Core/DynamicTypes/DynamicConvertibleType.swift",
    "Core/DynamicTypes/DynamicStringType.swift",
    "Core/DynamicTypes/DynamicValueOrUndefinedType.swift",
    "Core/DynamicTypes/DynamicViewType.swift",
    "Core/DynamicTypes/DynamicDictionaryType.swift",
    "Core/DynamicTypes/DynamicEitherType.swift",
    "Core/DynamicTypes/DynamicSharedObjectType.swift",
    "Core/DynamicTypes/DynamicVoidType.swift",
    "Core/DynamicTypes/DynamicArrayBufferType.swift",
    "Core/DynamicTypes/DynamicSwiftUIViewType.swift",
    "Core/DynamicTypes/DynamicEnumType.swift",
    "Core/DynamicTypes/DynamicBoolType.swift",
    "Core/DynamicTypes/DynamicOptionalType.swift",
    "Core/DynamicTypes/DynamicJavaScriptType.swift",
    "Core/DynamicTypes/DynamicRawType.swift",
    "Core/DynamicTypes/DynamicNumberType.swift",
    "Core/DynamicTypes/DynamicArrayType.swift",
    "Core/ArrayBuffers/ArrayBuffer.swift",
}

def file_uses_type(content, types):
    return any(t in content for t in types)

def insert_imports(content, imports_to_add):
    lines = content.split('\n')
    insert_after = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('//') or stripped == '':
            insert_after = i + 1
        else:
            break
    for imp in reversed(sorted(imports_to_add)):
        lines.insert(insert_after, imp)
    return '\n'.join(lines)

fixed = 0
for root, dirs, files in os.walk(EXPO_CORE_IOS):
    for fname in files:
        if not fname.endswith('.swift'):
            continue
        fpath = os.path.join(root, fname)
        rel = os.path.relpath(fpath, EXPO_CORE_IOS)
        try:
            with open(fpath, 'r') as f:
                content = f.read()

            imports_to_add = set()

            if file_uses_type(content, UIKIT_TYPES) and "import UIKit" not in content:
                imports_to_add.add("import UIKit")
            if file_uses_type(content, FOUNDATION_TYPES) and "import Foundation" not in content:
                imports_to_add.add("import Foundation")
            if rel in EXPO_JSI_FILES and "import ExpoModulesJSI" not in content:
                imports_to_add.add("import ExpoModulesJSI")

            if not imports_to_add:
                continue

            new_content = insert_imports(content, imports_to_add)
            with open(fpath, 'w') as f:
                f.write(new_content)
            fixed += 1
        except Exception as e:
            print(f"Error {fpath}: {e}")

print(f"expo-modules-core: patched {fixed} Swift files for Xcode 26 compatibility")
