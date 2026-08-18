# Tahajji

Chrome Extension to override fonts for Urdu Language

![imagename](https://github.com/simptive/tahajji/blob/master/images/small_promo.png)

[Chrome Web Store Link](https://chrome.google.com/webstore/detail/tahajji-urdu-reader/bknnphpbomfgdlmpgmnjhmbakpohppee)

## Description

Urdu Reader is an open-source browser extension designed to enhance the reading experience of Urdu content on the web. This GitHub project addresses common issues faced by users who are dissatisfied with default Urdu fonts provided by websites or experience compatibility problems with existing extensions on social media pages. Additionally, it caters to Linux users who may find Urdu fonts in the browser challenging to read.

## Key Features

1. **Independent of the HTML tags:** Efficiently detects Arabic and Urdu characters without relying on DOM meta data like DIR="rtl". When Arabic/Urdu text is mixed with other languages (e.g. English) in the same tag, only the Arabic/Urdu portion gets the font change — the rest is left untouched.

2. **Handles dynamically loaded content:** It activates after the page is initially completes loading but after that, handles dynamically loaded (AJAX) content without refreshing the page.

3. **Font Customization:** Urdu Reader provides a variety of fonts to choose from, allowing users to select the one that suits their preferences and readability.

4. **Font Size Adjustment:** Users can easily adjust the font size to ensure comfortable reading, catering to their visual needs.

5. **Line Height Control:** The extension also allows users to control the line height, further improving the legibility of Urdu text on webpages.

6. **Saves your settings:** Font selection, size and line-height settings don't need to re-configure everytime.

## Limitations

* Only global settings, it can't save different setting for each website.

## Setting up the project

Clone the repostitory and open as a project in your favorite editor. Open Chrome, go to Options > Extensions > Manage Extensions > Load Unpacked and select working directory.

## License

Released under the [MIT License](https://opensource.org/license/mit/).

## Credits

A fork of [Tahajji](https://github.com/simptive/tahajji) by [Yasir Mahmood](https://github.com/simptive). Full credit to the original project for the groundwork this builds on.
