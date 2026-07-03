#!/usr/bin/env python3
"""
Fix expo-modules-core Swift files for Xcode 26 compatibility.

Xcode 26 enables explicit modules by default. expo-modules-core 55.x Swift files
rely on implicit UIKit/Foundation imports that worked in earlier Xcode versions.
This script adds the missing imports directly to the source files.

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

fixed = 0
for root, dirs, files in os.walk(EXPO_CORE_IOS):
    for fname in files:
        if not fname.endswith('.swift'):
            continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, 'r') as f:
                content = f.read()

            imports_to_add = []
            if file_uses_type(content, UIKIT_TYPES) and "import UIKit" not in content:
                imports_to_add.append("import UIKit")
            if file_uses_type(content, FOUNDATION_TYPES) and "import Foundation" not in content:
                imports_to_add.append("import Foundation")

            if not imports_to_add:
                continue

            # Insert after leading comment block
            lines = content.split('\n')
            insert_after = 0
            for i, line in enumerate(lines):
                stripped = line.strip()
                if stripped.startswith('//') or stripped == '':
                    insert_after = i + 1
                else:
                    break

            for imp in reversed(imports_to_add):
                lines.insert(insert_after, imp)

            with open(fpath, 'w') as f:
                f.write('\n'.join(lines))

            fixed += 1
        except Exception as e:
            print(f"Error {fpath}: {e}")

print(f"expo-modules-core: added missing UIKit/Foundation imports to {fixed} Swift files")
