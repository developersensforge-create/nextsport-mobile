#!/usr/bin/env python3
"""
Fix expo-modules-core 55.x Swift files for Xcode 26 compatibility.

Xcode 26 enables SWIFT_ENABLE_EXPLICIT_MODULES=YES by default (and ignores
any attempt to disable it). This means Swift files must explicitly import
all their dependencies. expo-modules-core 55.x relied on implicit imports.

Two-part fix:
1. Add `import UIKit` / `import Foundation` to Swift files that use those types.
2. Add JSI ObjC headers to the ExpoModulesCore umbrella header, so Swift files
   can see RawArrayBuffer, JavaScriptValue, etc. via the ExpoModulesCore module
   (not via a separate ExpoModulesJSI module which doesn't exist in prebuilt mode).

Run: python3 scripts/fix_expo_modules_imports.py
"""
import os

EXPO_CORE_IOS = "node_modules/expo-modules-core/ios"
UMBRELLA_HEADER = os.path.join(EXPO_CORE_IOS, "ExpoModulesCore.h")

# ── Part 1: Add UIKit / Foundation imports to Swift files ─────────────────────

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
    lines = content.split("\n")
    insert_after = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("//") or stripped == "":
            insert_after = i + 1
        else:
            break
    for imp in reversed(sorted(imports_to_add)):
        if imp not in content:
            lines.insert(insert_after, imp)
    return "\n".join(lines)

fixed = 0
for root, dirs, files in os.walk(EXPO_CORE_IOS):
    for fname in files:
        if not fname.endswith(".swift"):
            continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, "r") as f:
                content = f.read()

            imports_to_add = set()
            if file_uses_type(content, UIKIT_TYPES) and "import UIKit" not in content:
                imports_to_add.add("import UIKit")
            if file_uses_type(content, FOUNDATION_TYPES) and "import Foundation" not in content:
                imports_to_add.add("import Foundation")
            # NOTE: Do NOT add `import ExpoModulesJSI` — that module does not exist
            # in CI prebuilt mode. JSI types are exposed via the umbrella header instead
            # (see Part 2 below).

            if not imports_to_add:
                continue

            new_file = insert_imports(content, imports_to_add)
            with open(fpath, "w") as f:
                f.write(new_file)
            fixed += 1
        except Exception as e:
            print(f"Error {fpath}: {e}")

print(f"expo-modules-core: patched {fixed} Swift files (UIKit/Foundation imports)")

# ── Part 2: Add JSI ObjC headers to ExpoModulesCore umbrella header ───────────
# In Xcode 26 explicit modules mode, Swift files in ExpoModulesCore that use
# RawArrayBuffer, JavaScriptValue, etc. cannot see these types unless they are
# declared in the ExpoModulesCore module itself (via its umbrella/module header).
#
# ExpoModulesCore.h already imports EXJSIInstaller.h (which has EXRuntime etc.),
# but the array buffer types (EXArrayBuffer, EXNativeArrayBuffer) are missing.
#
# We add the missing JSI headers to the umbrella header so the Swift compiler
# can find these ObjC types when compiling ExpoModulesCore Swift files.

JSI_HEADERS_TO_ADD = [
    "#import <ExpoModulesCore/EXArrayBuffer.h>",
    "#import <ExpoModulesCore/EXNativeArrayBuffer.h>",
    "#import <ExpoModulesCore/EXJavaScriptValue.h>",
    "#import <ExpoModulesCore/EXJavaScriptObject.h>",
    "#import <ExpoModulesCore/EXJavaScriptRuntime.h>",
    "#import <ExpoModulesCore/EXJavaScriptWeakObject.h>",
    "#import <ExpoModulesCore/EXJavaScriptTypedArray.h>",
]

# Verify each header file actually exists before adding to umbrella
JSI_DIR = os.path.join(EXPO_CORE_IOS, "JSI")
existing_headers = set(os.listdir(JSI_DIR)) if os.path.isdir(JSI_DIR) else set()
print(f"JSI headers found: {sorted(existing_headers)}")

headers_to_insert = []
for h in JSI_HEADERS_TO_ADD:
    # Extract filename from #import <ExpoModulesCore/EXFoo.h>
    fname = h.split("/")[-1].rstrip(">")
    if fname in existing_headers:
        headers_to_insert.append(h)
        print(f"  Will add: {h}")
    else:
        print(f"  SKIP (not found): {fname}")

if headers_to_insert:
    with open(UMBRELLA_HEADER, "r") as f:
        umbrella = f.read()

    # Check which ones are already there
    to_add = [h for h in headers_to_insert if h not in umbrella]

    if to_add:
        # Insert after the last existing #import line
        marker = "#import <ExpoModulesCore/EXJSIInstaller.h>"
        if marker in umbrella:
            insertion = "\n" + "\n".join(to_add)
            umbrella = umbrella.replace(marker, marker + insertion)
        else:
            # Fallback: append at end
            umbrella += "\n" + "\n".join(to_add) + "\n"

        with open(UMBRELLA_HEADER, "w") as f:
            f.write(umbrella)
        print(f"ExpoModulesCore.h: added {len(to_add)} JSI headers")
    else:
        print("ExpoModulesCore.h: JSI headers already present, skipping")
else:
    print("WARNING: No JSI headers found to add — check JSI directory path")
