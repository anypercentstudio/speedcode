# speedcode

speedcode is a chrome extension that enhances leetcode and is literally always etc and so forth and so on and it's like shut up and therefore

## installation

### chrome

1. **clone the repository**

    ```bash
    git clone https://github.com/saracheak/speedcode.git
    cd speedcode
    ```

2. **install dependencies**

    ```bash
    npm install
    ```

3. **build the extension**

    ```bash
    npm run build
    ```

4. **load in chrome**
    - open chrome and navigate to `chrome://extensions/`
    - toggle on **"Developer mode"** (top right)
    - click **"Load unpacked"**
    - select the `dist` folder from the project directory

### firefox

### Firefox

1. **follow steps 1-2 above**

2. **build for firefox**

    ```bash
    npm run build:firefox
    ```

3. **load in firefox**
    - open firefox and navigate to `about:debugging`
    - click **"This Firefox"**
    - click **"Load Temporary Add-on"**
    - select the `manifest-firefox.json` file from the `dist-firefox` folder

### build for Both Browsers

```bash
npm run build:all        # builds for both chrome and firefox
npm run package:all      # creates zip files for distribution
```

## what we do

-   [x] problem detection
-   [x] manual timer
-   [x] individual and shared problem bucket
-   [x] cross-browser support (chrome + firefox)

## what we gon do

-   [ ] ranking system

## architecture

```
src/
├── popup.js
├── modules/
│   ├── auth.js          # authentication & user management
│   ├── database.js      # firebase/firestore operations
│   ├── ui.js            # UI management & DOM manipulation
│   ├── state.js         # centralized state management
│   └── utils.js         # utilities & helper functions
├── popup.html
├── popup.css
└── firebaseConfig.js
```

## license

this project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## acknowledgments

thank u T. Swift and J. Christ (in that order)

## credits

dev & co-dev.
