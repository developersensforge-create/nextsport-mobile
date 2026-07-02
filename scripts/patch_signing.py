import re

# Patch pbxproj: force Manual signing for Release build
# Must run AFTER expo prebuild (which regenerates ios/)
pbxproj = 'ios/NextSport.xcodeproj/project.pbxproj'
with open(pbxproj) as f:
    content = f.read()

TEAM = '58BKXDS287'
PROFILE_UUID = '4dd97dbd-ac51-4327-a32b-8ac23e5e286c'

signing_block = (
    '\n\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";'
    '\n\t\t\t\tCODE_SIGN_STYLE = Manual;'
    '\n\t\t\t\tDEVELOPMENT_TEAM = ' + TEAM + ';'
    '\n\t\t\t\tPROVISIONING_PROFILE = "' + PROFILE_UUID + '";'
    '\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "";'
)

pattern = r'(/\* Release \*/ = \{.*?buildSettings = \{)(.*?ASSETCATALOG_COMPILER_APPICON_NAME.*?)(\t\t\t\};)'

def inject(m):
    settings = m.group(2)
    settings = re.sub(r'\n\t+CODE_SIGN_IDENTITY[^\n]*', '', settings)
    settings = re.sub(r'\n\t+CODE_SIGN_STYLE[^\n]*', '', settings)
    settings = re.sub(r'\n\t+DEVELOPMENT_TEAM[^\n]*', '', settings)
    settings = re.sub(r'\n\t+PROVISIONING_PROFILE[^\n]*', '', settings)
    return m.group(1) + settings + signing_block + '\n' + m.group(3)

new_content, count = re.subn(pattern, inject, content, flags=re.DOTALL)
print(f"Modified {count} Release block(s)")

with open(pbxproj, 'w') as f:
    f.write(new_content)

with open(pbxproj) as f:
    verify = f.read()
assert PROFILE_UUID in verify, "FAIL: UUID not found in pbxproj!"
assert 'CODE_SIGN_STYLE = Manual' in verify, "FAIL: Manual signing not set!"
print("OK: pbxproj signing patched successfully")
