# Change Log

# 1.6.0
- It is now possible to move groups and favorites back to the top level/root element using the element picker

# 1.5.3
- Fixed Bug #17 wwhich caused context actions to leak into other views

# 1.5.2
- Hotifx : Missing dependency caused the extension to crash round 2
- Moved build to webpack

# 1.5.1
- Hotifx : Missing dependency caused the extension to crash

# 1.5.0
- Added support for folder based favorites (including file filters with glob support)
- Quality of life improvements
- Code cleanup and refactoring

# 1.4.0
- The group picker now displays the group's path in the hierarchy

## 1.3.0
- Code cleanup
- Added support for nested groups

## 1.2.1
- Bug squashing
- Changed tree update mechanism
- Moved away from promises and adopted async code

## 1.2.0
- Changed the storage strategy to a local json file
- Added support for editing directly the favorites configuration file (JSON)
## 1.1.0

- Favorites can now be moved between Groups using the "Move to..." context menu
- All the Quick Picks plus the Favorites bar are now correctly sorted
- Prevents users from creating duplicated Favorites
- Undesired commands are now hidden in the Palette
- When opening a Favorite, the group which the Favorite belongs to is shown in the Quick Pick
- Revamped the icon

## 1.0.0

- Initial release