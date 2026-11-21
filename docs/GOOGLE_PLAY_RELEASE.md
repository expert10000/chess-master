# Google Play release preparation

## Play Console app details

Use **Stockfish Coach** as the initial public name, **English** as the default language, **Game**, and **Free**. Set the public support and privacy contact to `dareks.inf@gmail.com`. Describe the product as an independent chess training app powered by Stockfish; do not imply endorsement by the Stockfish project. A separate domain is optional for app creation. The privacy policy draft is at [`privacy.html`](privacy.html); publish it as a public HTTPS page (for example, through GitHub Pages), verify the live URL, and use that exact URL in Play Console. The app also shows privacy text under **Moves → Privacy & open source**.

The Android application ID is `com.expert10000.stockfishcoach`. Confirm that it matches the app created in Play Console before uploading. Changing it later creates a different app. The Android project targets API 36, the current requirement for a new phone app. The debug APK is for USB testing; Play requires an Android App Bundle (`.aab`).

## Build and sign

Run `npm run android:sync`, then build from `android/` with Java 21:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
.\gradlew.bat bundleRelease
```

Without signing variables this produces `android/app/build/outputs/bundle/release/app-release.aab`, but **the bundle is unsigned and cannot be uploaded**. Create and securely back up a private upload keystore. Keep the keystore and passwords outside the repository. Set all four environment variables before building the upload bundle:

- `CHESS_COACH_UPLOAD_STORE_FILE`: absolute path to the upload keystore
- `CHESS_COACH_UPLOAD_STORE_PASSWORD`
- `CHESS_COACH_UPLOAD_KEY_ALIAS`
- `CHESS_COACH_UPLOAD_KEY_PASSWORD`

Gradle signs the release bundle when all four are present. Verify its signature with `jarsigner -verify` and keep the same upload key for updates. Play App Signing manages the key that signs the APKs delivered to users. Increment `versionCode` for every new upload; it is currently `1`.

## Before the first testing release

1. Verify the Play Console account and the app's package name. For a personal developer account created after 13 November 2023, Google requires 12 testers continuously opted in to a closed test for 14 days before production access can be requested.
2. Publish a privacy policy on a public, non-editable web page and link it in Play Console and within the app. It must name the app or developer, provide a privacy contact, cover on-device game and puzzle storage, optional Lichess puzzle requests, Android backup behavior, retention, and deletion. Complete the Data safety form consistently with the final policy and the released bundle.
3. Prepare the store listing: app icon, feature graphic, at least two genuine app screenshots, description, category, support email, and content rating. Check the Play Console dashboard for other required declarations.
4. Make the bundled Stockfish 19.0.1 engine's GPLv3 license and exact corresponding source available to users. The build already includes the GPLv3 license text. Review the release package against the [Stockfish.js 19.0.1 source](https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1) and include an accessible source pointer in the published app/release information.
5. Test the signed bundle through Play's internal track, then closed testing if required. Verify game play, engine hints, puzzle downloads, portrait and landscape layout, PGN sharing, and persistence on a Play-installed build. USB debug installs alone do not verify Play App Signing or Play delivery.

The repository-wide `npm run typecheck` currently fails on unrelated existing TypeScript errors. `npm test` (191 tests), `npm run build`, `npm run release:static`, and the mobile/puzzle Playwright checks passed on 20 November 2026. The API 36 debug build was installed and checked on a Galaxy A56 running Android 16 in portrait and landscape. Fix the typecheck errors before treating the repository's `release:qa` gate as passed.

Official references: [target API level](https://support.google.com/googleplay/android-developer/answer/11926878), [app bundles](https://support.google.com/googleplay/android-developer/answer/9844279), [app signing](https://developer.android.com/studio/publish/app-signing), [new personal account testing](https://support.google.com/googleplay/android-developer/answer/14151465), [privacy policy and Data safety](https://support.google.com/googleplay/android-developer/answer/10144311), [store graphics](https://support.google.com/googleplay/android-developer/answer/9866151).
