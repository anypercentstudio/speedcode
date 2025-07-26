# speedcode

speedcode is a chrome extension that enhances leetcode and is literally always etc and so forth and so on and it's like shut up and therefore

## installation

1. **clone the repository**

    ```bash
    git clone https://github.com/yourusername/speedcode.git
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

## what we do

-   [x] problem detection
-   [x] manual timer
-   [x] individual and shared problem bucket

## what we gon do

-   [ ] ranking system
-   [ ] firefox support

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
