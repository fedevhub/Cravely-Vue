# Cravely — Vue 3 + Vite + Firebase PWA

This project has been migrated from Express/EJS + MongoDB to a Vue 3 single-page application. The former Express, EJS, controller, route, model, and MongoDB source files have been removed; its original public CSS and image assets are retained to preserve the existing visual design.

## Run

1. Create a Firebase project, enable **Email/Password** in Authentication, then create Firestore and Storage.
2. Copy `.env.example` values into `.env` using the Firebase Web App configuration.
3. Deploy `firestore.rules` and `storage.rules` with the Firebase CLI. To make an administrator, change that user's `users/{uid}.role` to `admin` in Firestore.
4. Run `npm install` and `npm run dev`.

`npm run build` generates the installable PWA production build in `dist/`. Firestore collections used are `users`, `products`, and `orders`; cart and wishlist are user subcollections.
