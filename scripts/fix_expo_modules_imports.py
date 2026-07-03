#!/usr/bin/env python3
"""
Fix expo-modules-core 55.x Swift files for Xcode 26 compatibility.

Adds missing UIKit and Foundation imports to Swift files that use types
from those frameworks without explicit imports (e.g. UIView, CGFloat, Data).

SDK 56 fixed this properly by adding import ExpoModulesJSI, but in SDK 55
ExpoModulesJSI is not Swift-importable. Instead we rely on SWIFT_ENABLE_EXPLICIT_MODULES=NO
via the Podfile patch, and add the basic UIKit/Foundation imports here.

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
        if imp not in content:
            lines.insert(insert_after, imp)
    return '\n'.join(lines)

fixed = 0
for root, dirs, files in os.walk(EXPO_CORE_IOS):
    for fname in files:
        if not fname.endswith('.swift'):
            continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, 'r') as f:
                content = f.read()

            imports_to_add = set()
            if file_uses_type(content, UIKIT_TYPES) and "import UIKit" not in content:
                imports_to_add.add("import UIKit")
            if file_uses_type(content, FOUNDATION_TYPES) and "import Foundation" not in content:
                imports_to_add.add("import Foundation")

            if not imports_to_add:
                continue

            new_file = insert_imports(content, imports_to_add)
            with open(fpath, 'w') as f:
                f.write(new_file)
            fixed += 1
        except Exception as e:
            print(f"Error {fpath}: {e}")

print(f"expo-modules-core: patched {fixed} Swift files with UIKit/Foundation imports for Xcode 26")
