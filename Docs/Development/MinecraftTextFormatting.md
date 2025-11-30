# Minecraft Bedrock Edition Text Formatting Guide

This document provides a comprehensive guide to the text formatting codes used in Minecraft: Bedrock Edition. These codes allow you to add color and style to in-game text, such as in chat, on signs, in books, and in world/item names.

## Usage

To use a formatting code, you must prefix it with the section sign (`§`). On most keyboards, this can be typed by holding `Alt` and typing `21` on the numpad, or by copying and pasting it directly.

**Example:**
To make text red, you would type: `§cHello World`. This will display as red text in the game.

You can combine a color code with one or more style codes. The style codes must come *after* the color code.

**Example:**
To make text bold and green, you would type: `§a§lBold Green Text`. This will display as bold, green text in the game.

---

## Color Codes

Here is a list of all available color codes in Bedrock Edition.

| Code | Color Name      | Hex Code | Example Usage      |
| :--- | :-------------- | :------- | :----------------- |
| `§0` | Black           | `#000000`| `§0Black Text`     |
| `§1` | Dark Blue       | `#0000AA`| `§1Dark Blue Text` |
| `§2` | Dark Green      | `#00AA00`| `§2Dark Green Text`|
| `§3` | Dark Aqua       | `#00AAAA`| `§3Dark Aqua Text` |
| `§4` | Dark Red        | `#AA0000`| `§4Dark Red Text`  |
| `§5` | Dark Purple     | `#AA00AA`| `§5Dark Purple Text`|
| `§6` | Gold            | `#FFAA00`| `§6Gold Text`      |
| `§7` | Gray            | `#AAAAAA`| `§7Gray Text`      |
| `§8` | Dark Gray       | `#555555`| `§8Dark Gray Text` |
| `§9` | Blue            | `#5555FF`| `§9Blue Text`      |
| `§a` | Green           | `#55FF55`| `§aGreen Text`     |
| `§b` | Aqua            | `#55FFFF`| `§bAqua Text`      |
| `§c` | Red             | `#FF5555`| `§cRed Text`       |
| `§d` | Light Purple    | `#FF55FF`| `§dLight Purple Text`|
| `§e` | Yellow          | `#FFFF55`| `§eYellow Text`    |
| `§f` | White           | `#FFFFFF`| `§fWhite Text`     |
| `§g` | Minecoin Gold   | `#FFD700`| `§gMinecoin Gold Text`|

---

## Style Codes

These codes can be used to add styling to text. They can be combined with each other and with a color code.

| Code | Style Name    | Description                                       | Example Usage           |
| :--- | :------------ | :------------------------------------------------ | :---------------------- |
| `§l` | **Bold**      | Makes the text bold.                              | `§lBold Text`           |
| `§o` | *Italic*      | Makes the text italic.                            | `§oItalic Text`         |
| `§k` | Obfuscated    | Displays random, changing characters.             | `§kRandom`              |
| `§r` | Reset         | Resets all formatting (color and style) to default. | `§cRed §rReset`         |

---

## Special Codes (Bedrock Exclusive)

| Code | Style Name | Description                                                                                             |
| :--- | :--------- | :------------------------------------------------------------------------------------------------------ |
| `§g` | Minecoin Gold | A specific shade of gold used for Minecoin-related text.                                               |

---

## Important Notes

- If you use multiple color codes in a row, only the **last** one will be applied.
- If you use a style code before a color code, the style might be reset. Always apply the color first.
- The `§r` (Reset) code is very useful for returning to default formatting within the same line of text without starting a new line.
- The `§k` (Obfuscated) effect will continue until a `§r` (Reset) is used or a new color code is applied.
